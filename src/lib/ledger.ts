import { Prisma, WalletTxnType, CaseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { pickProcessorId } from "./caseCreation";

/**
 * Wallet balances are never stored as a single mutable column. Every
 * top-up, debit, refund, or payout is a new row in WalletTransaction, and
 * each row records the running balanceAfter at the moment it was written.
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
  amount: number | string;
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

/** After payment: PAID → UNDER_VERIFICATION + auto-assign processor. */
export async function advancePaidCasesToVerification(params: {
  caseIds: string[];
  actorUserId: string;
}) {
  const processorId = await pickProcessorId();
  for (const caseId of params.caseIds) {
    const kase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!kase || kase.status !== "PAID") continue;
    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: "UNDER_VERIFICATION",
        assignedProcessorId: processorId ?? kase.assignedProcessorId,
      },
    });
    await prisma.caseStatusEvent.create({
      data: {
        caseId,
        fromStatus: "PAID",
        toStatus: "UNDER_VERIFICATION",
        note: processorId
          ? "Queued for document verification."
          : "Queued for verification (no processor assigned yet).",
        actorUserId: params.actorUserId,
      },
    });
  }
}

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
      const result = await prisma.$transaction(
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
                note: `Case ${kase.referenceNo} — gov + platform + processor fees`,
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

      await advancePaidCasesToVerification({ caseIds, actorUserId });
      return result;
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

/** Consumer online payment: mark cases PAID then UNDER_VERIFICATION (no partner wallet). */
export async function payConsumerCases(params: {
  consumerUserId: string;
  caseIds: string[];
  actorUserId: string;
  orderId?: string;
}) {
  const { consumerUserId, caseIds, actorUserId, orderId } = params;
  if (caseIds.length === 0) throw new Error("No cases selected.");

  const cases = await prisma.case.findMany({
    where: { id: { in: caseIds }, consumerUserId },
  });
  if (cases.length !== caseIds.length) {
    throw new Error("One or more cases could not be found for this consumer.");
  }
  const ineligible = cases.filter((c) => c.status !== "PENDING_PAYMENT");
  if (ineligible.length > 0) {
    throw new Error(`Case ${ineligible[0].referenceNo} is not awaiting payment.`);
  }

  await prisma.$transaction(async (tx) => {
    for (const kase of cases) {
      await tx.case.update({
        where: { id: kase.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.caseStatusEvent.create({
        data: {
          caseId: kase.id,
          fromStatus: "PENDING_PAYMENT",
          toStatus: "PAID",
          note: orderId ? `Paid online — order ${orderId}` : "Paid online",
          actorUserId,
        },
      });
    }
  });

  await advancePaidCasesToVerification({ caseIds, actorUserId });
  return { casesPaid: cases.length };
}

export async function applyPaymentOrder(orderId: string) {
  const order = await prisma.walletTopupOrder.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "PENDING") return { alreadyProcessed: true as const };

  if (order.purpose === "CASE_PAYMENT" && order.consumerUserId && !order.partnerId) {
    const caseIds = (order.caseIds as string[] | null) ?? [];
    const result = await payConsumerCases({
      consumerUserId: order.consumerUserId,
      caseIds,
      actorUserId: order.createdByUserId,
      orderId: order.id,
    });
    await prisma.walletTopupOrder.update({
      where: { id: order.id },
      data: { status: "SUCCESS", completedAt: new Date() },
    });
    return { alreadyProcessed: false as const, purpose: order.purpose, casesPaid: result.casesPaid };
  }

  if (!order.partnerId) {
    throw new Error("Payment order is missing partnerId.");
  }

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

export async function refundCase(params: { caseId: string; note?: string }) {
  const { caseId, note } = params;
  const debit = await prisma.walletTransaction.findFirst({
    where: { referenceCaseId: caseId, type: "DEBIT" },
    orderBy: { createdAt: "desc" },
  });
  if (!debit) return null;
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
