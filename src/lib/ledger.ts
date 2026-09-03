import { Prisma, WalletTxnType, CaseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { notify } from "./notify";

/**
 * Wallet balances are never stored as a single mutable column. Every
 * top-up, debit, refund, or payout is a new row in WalletTransaction, and
 * each row records the running balanceAfter at the moment it was written.
 * The "current balance" is just the balanceAfter of the most recent row.
 *
 * Concurrency: two simultaneous debits for the same partner must not read
 * the same "last balance" and race. We use Postgres SERIALIZABLE isolation
 * and retry on conflict.
 */

const MAX_RETRIES = 3;

export class InsufficientBalanceError extends Error {}

export async function getCurrentBalance(partnerId: string): Promise<Prisma.Decimal> {
  const last = await prisma.walletTransaction.findFirst({
    where: { partnerId },
    orderBy: { createdAt: "desc" },
  });
  return last ? last.balanceAfter : new Prisma.Decimal(0);
}

export async function appendWalletTransaction(params: {
  partnerId: string;
  type: WalletTxnType;
  amount: number | string; // always a positive amount; `type` determines direction
  referenceCaseId?: string;
  batchId?: string;
  note?: string;
}) {
  const { partnerId, type, amount, referenceCaseId, batchId, note } = params;
  const amountDecimal = new Prisma.Decimal(amount);
  if (amountDecimal.lessThanOrEqualTo(0)) {
    throw new Error("Wallet transaction amount must be positive.");
  }
  const direction = type === "TOPUP" || type === "REFUND" ? 1 : -1;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const last = await tx.walletTransaction.findFirst({
            where: { partnerId },
            orderBy: { createdAt: "desc" },
          });
          const currentBalance = last ? last.balanceAfter : new Prisma.Decimal(0);
          const balanceAfter = currentBalance.plus(amountDecimal.times(direction));
          if (balanceAfter.lessThan(0)) {
            throw new InsufficientBalanceError(
              `Insufficient wallet balance: has ${currentBalance.toFixed(2)}, needs ${amountDecimal.toFixed(2)}.`
            );
          }
          return tx.walletTransaction.create({
            data: { partnerId, type, amount: amountDecimal, balanceAfter, referenceCaseId, batchId, note },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err) {
      if (err instanceof InsufficientBalanceError) throw err;
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationFailure && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new Error("Wallet transaction failed after retries.");
}

/**
 * Batch-pay every listed case from the partner's wallet in one atomic
 * operation — the "select several unpaid cases, hit Save" pattern from the
 * real Pending Payment screen. Either every case is debited and moved to
 * PAID, or (on insufficient balance / a case not being eligible) nothing
 * happens — there is no partial payment of a batch.
 */
export async function payCasesFromWallet(params: {
  partnerId: string;
  caseIds: string[];
  actorUserId: string;
}) {
  const { partnerId, caseIds, actorUserId } = params;
  if (caseIds.length === 0) throw new Error("No cases selected.");

  const batchId = `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const cases = await tx.case.findMany({
            where: { id: { in: caseIds }, partnerId },
          });
          if (cases.length !== caseIds.length) {
            throw new Error("One or more selected cases could not be found for this partner.");
          }
          const ineligible = cases.filter((c) => c.status !== "PENDING_PAYMENT");
          if (ineligible.length > 0) {
            throw new Error(
              `Case ${ineligible[0].referenceNo} is not awaiting payment (status: ${ineligible[0].status}).`
            );
          }

          const last = await tx.walletTransaction.findFirst({
            where: { partnerId },
            orderBy: { createdAt: "desc" },
          });
          let runningBalance = last ? last.balanceAfter : new Prisma.Decimal(0);

          const total = cases.reduce(
            (sum, c) => sum.plus(c.govFeeSnapshot).plus(c.serviceFeeSnapshot),
            new Prisma.Decimal(0)
          );
          if (runningBalance.lessThan(total)) {
            throw new InsufficientBalanceError(
              `Insufficient wallet balance: has ${runningBalance.toFixed(2)}, needs ${total.toFixed(2)} for ${cases.length} case(s). Recharge your wallet first.`
            );
          }

          for (const kase of cases) {
            const caseTotal = kase.govFeeSnapshot.plus(kase.serviceFeeSnapshot);
            runningBalance = runningBalance.minus(caseTotal);
            await tx.walletTransaction.create({
              data: {
                partnerId,
                type: "DEBIT",
                amount: caseTotal,
                balanceAfter: runningBalance,
                referenceCaseId: kase.id,
                batchId,
                note: `Case ${kase.referenceNo} — gov fee + service fee`,
              },
            });
            await tx.case.update({
              where: { id: kase.id },
              data: { status: "PAID", paidAt: new Date() },
            });
            await tx.caseStatusEvent.create({
              data: {
                caseId: kase.id,
                fromStatus: "PENDING_PAYMENT" as CaseStatus,
                toStatus: "PAID" as CaseStatus,
                note: `Paid via wallet — batch ${batchId}`,
                actorUserId,
              },
            });
          }

          return { batchId, casesPaid: cases.length, total, balanceAfter: runningBalance };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err) {
      if (err instanceof InsufficientBalanceError) throw err;
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationFailure && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new Error("Batch payment failed after retries.");
}

/**
 * Applies a completed (gateway-confirmed) payment order. Called from both
 * the dev completion route and the real PayU webhook — never from a
 * client-triggered "mark this paid" call, since only a verified gateway
 * confirmation should ever reach here.
 *
 * - WALLET_TOPUP: straightforward TOPUP into the ledger.
 * - CASE_PAYMENT (the hybrid "pay online now" option): the funds are
 *   credited and then immediately spent on exactly the listed cases in
 *   the same operation, via payCasesFromWallet. Net effect on the wallet
 *   balance is zero — this is deliberate. It means a direct online
 *   payment for a batch of cases still produces the exact same ledger
 *   shape (one DEBIT per case, same batchId) as paying from an existing
 *   wallet balance, so reporting never needs to special-case "how was
 *   this paid for."
 */
export async function applyPaymentOrder(orderId: string) {
  const order = await prisma.walletTopupOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PENDING") return { alreadyProcessed: true as const };

  if (order.purpose === "WALLET_TOPUP") {
    const txn = await appendWalletTransaction({
      partnerId: order.partnerId,
      type: "TOPUP",
      amount: order.amount.toNumber(),
      note: `Wallet top-up — order ${order.id}`,
    });
    await prisma.walletTopupOrder.update({
      where: { id: order.id },
      data: { status: "SUCCESS", completedAt: new Date(), walletTransactionId: txn.id },
    });
    return { alreadyProcessed: false as const, purpose: order.purpose, balanceAfter: txn.balanceAfter };
  }

  // CASE_PAYMENT
  const caseIds = (order.caseIds as string[] | null) ?? [];
  await appendWalletTransaction({
    partnerId: order.partnerId,
    type: "TOPUP",
    amount: order.amount.toNumber(),
    batchId: order.id,
    note: `Direct online payment — order ${order.id} (credited then spent on ${caseIds.length} case(s) below)`,
  });
  const result = await payCasesFromWallet({
    partnerId: order.partnerId,
    caseIds,
    actorUserId: order.createdByUserId,
  });
  await prisma.walletTopupOrder.update({
    where: { id: order.id },
    data: { status: "SUCCESS", completedAt: new Date() },
  });
  return { alreadyProcessed: false as const, purpose: order.purpose, casesPaid: result.casesPaid };
}

/** Refund whatever was debited for a case (used when an ADMIN cancels a PAID/SUBMITTED case). */
export async function refundCase(params: { caseId: string; note?: string }) {
  const { caseId, note } = params;
  const debit = await prisma.walletTransaction.findFirst({
    where: { referenceCaseId: caseId, type: "DEBIT" },
    orderBy: { createdAt: "desc" },
  });
  if (!debit) return null; // nothing was ever charged for this case
  const kase = await prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  const txn = await appendWalletTransaction({
    partnerId: debit.partnerId,
    type: "REFUND",
    amount: debit.amount.toNumber(),
    referenceCaseId: caseId,
    note: note ?? `Refund for cancelled case ${kase.referenceNo}`,
  });
  await notify({
    partnerId: debit.partnerId,
    channel: "INAPP",
    subject: `Refund issued for ${kase.referenceNo}`,
    body: `${debit.amount.toFixed(2)} was refunded to your wallet.`,
  });
  return txn;
}
