import { Prisma, WalletTxnType, CaseStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { pickProcessorId } from "./caseCreation";
import { bookingIdFromReference } from "./reference";

async function isoByCountryIds(countryIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(countryIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await prisma.country.findMany({
    where: { id: { in: unique } },
    select: { id: true, isoCode: true },
  });
  return new Map(rows.map((r) => [r.id, r.isoCode]));
}


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
  for (const caseId of params.caseIds) {
    // Re-pick per case so load is spread across the batch, not pinned to one processor.
    const processorId = await pickProcessorId();
    const claimed = await prisma.case.updateMany({
      where: { id: caseId, status: "PAID" },
      data: {
        status: "UNDER_VERIFICATION",
        ...(processorId ? { assignedProcessorId: processorId } : {}),
      },
    });
    if (claimed.count === 0) continue;
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

/** Never fail payment settlement if the PAID→queue step hiccups — retry once, then log. */
async function safeAdvancePaidCasesToVerification(params: {
  caseIds: string[];
  actorUserId: string;
}) {
  try {
    await advancePaidCasesToVerification(params);
  } catch (err) {
    console.error("[ledger] advance to verification failed, retrying once:", err);
    try {
      await advancePaidCasesToVerification(params);
    } catch (err2) {
      console.error(
        "[ledger] advance retry failed — cases may remain PAID until next payment retry/ops:",
        err2
      );
    }
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
          const payable = cases.filter((c) => c.status === "PENDING_PAYMENT");
          const settled = cases.filter((c) => c.status !== "PENDING_PAYMENT" && c.status !== "DRAFT");
          // Idempotent retry after a partial Stripe apply: all cases already paid.
          if (payable.length === 0) {
            if (settled.length === cases.length) {
              const last = await tx.walletTransaction.findFirst({
                where: { partnerId },
                orderBy: { createdAt: "desc" },
              });
              return {
                batchId,
                casesPaid: 0,
                total: new Prisma.Decimal(0),
                balanceAfter: last ? last.balanceAfter : new Prisma.Decimal(0),
              };
            }
            throw new Error(
              `Case ${cases[0].referenceNo} is not awaiting payment (status: ${cases[0].status}).`
            );
          }
          if (payable.length !== cases.length) {
            throw new Error(
              `Case ${cases.find((c) => c.status !== "PENDING_PAYMENT")!.referenceNo} is not awaiting payment.`
            );
          }

          const last = await tx.walletTransaction.findFirst({
            where: { partnerId },
            orderBy: { createdAt: "desc" },
          });
          let runningBalance = last ? last.balanceAfter : new Prisma.Decimal(0);

          const total = payable.reduce(
            (sum, c) => sum.plus(c.govFeeSnapshot).plus(c.serviceFeeSnapshot),
            new Prisma.Decimal(0)
          );
          if (runningBalance.lessThan(total)) {
            throw new InsufficientBalanceError(
              `Insufficient wallet balance: has ${runningBalance.toFixed(2)}, needs ${total.toFixed(2)} for ${payable.length} case(s). Recharge your wallet first.`
            );
          }

          const isoMap = await isoByCountryIds(payable.map((c) => c.countryId));

          for (const kase of payable) {
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
            const iso = isoMap.get(kase.countryId);
            await tx.case.update({
              where: { id: kase.id },
              data: {
                status: "PAID",
                paidAt: new Date(),
                bookingId: kase.bookingId || bookingIdFromReference(kase.referenceNo, iso),
              },
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

          return { batchId, casesPaid: payable.length, total, balanceAfter: runningBalance };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      await safeAdvancePaidCasesToVerification({ caseIds, actorUserId });
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

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const paidIds = await prisma.$transaction(
        async (tx) => {
          const cases = await tx.case.findMany({
            where: { id: { in: caseIds }, consumerUserId },
          });
          if (cases.length !== caseIds.length) {
            throw new Error("One or more cases could not be found for this consumer.");
          }

          const payable = cases.filter((c) => c.status === "PENDING_PAYMENT");
          const settled = cases.filter(
            (c) => c.status !== "PENDING_PAYMENT" && c.status !== "DRAFT" && c.status !== "CANCELLED"
          );
          // Idempotent Stripe retry: already paid — still return ids stuck in PAID for advance.
          if (payable.length === 0) {
            if (settled.length === cases.length) {
              return cases.filter((c) => c.status === "PAID").map((c) => c.id);
            }
            throw new Error(`Case ${cases[0].referenceNo} is not awaiting payment.`);
          }
          if (payable.length !== cases.length) {
            throw new Error(
              `Case ${cases.find((c) => c.status !== "PENDING_PAYMENT")!.referenceNo} is not awaiting payment.`
            );
          }

          const isoMap = await isoByCountryIds(payable.map((c) => c.countryId));
          const claimed: string[] = [];

          for (const kase of payable) {
            const iso = isoMap.get(kase.countryId);
            const updated = await tx.case.updateMany({
              where: { id: kase.id, status: "PENDING_PAYMENT" },
              data: {
                status: "PAID",
                paidAt: new Date(),
                bookingId: kase.bookingId || bookingIdFromReference(kase.referenceNo, iso),
              },
            });
            if (updated.count === 0) continue;
            claimed.push(kase.id);
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

          if (claimed.length === 0) {
            // Concurrent claim won — treat as settled if now past PENDING_PAYMENT.
            const refreshed = await tx.case.findMany({
              where: { id: { in: caseIds }, consumerUserId },
              select: { id: true, status: true },
            });
            const stuckPaid = refreshed.filter((c) => c.status === "PAID").map((c) => c.id);
            if (stuckPaid.length > 0 || refreshed.every((c) => c.status !== "PENDING_PAYMENT")) {
              return stuckPaid;
            }
            throw new Error("No cases were awaiting payment.");
          }
          return claimed;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      // Advance must not fail the settled payment / Stripe order claim.
      if (paidIds.length > 0) {
        await safeAdvancePaidCasesToVerification({ caseIds: paidIds, actorUserId });
      } else {
        // Settled past PAID already — still try advancing any leftover PAID rows in the batch.
        await safeAdvancePaidCasesToVerification({ caseIds, actorUserId });
      }
      return { casesPaid: paidIds.length };
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (isSerializationFailure && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }
  throw new Error("Consumer payment failed after retries.");
}

export async function applyPaymentOrder(orderId: string) {
  // Atomic claim — concurrent Stripe deliveries / retries cannot double-credit.
  const claimed = await prisma.walletTopupOrder.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "SUCCESS", completedAt: new Date() },
  });
  if (claimed.count === 0) return { alreadyProcessed: true as const };

  const order = await prisma.walletTopupOrder.findUniqueOrThrow({ where: { id: orderId } });

  try {
    if (order.purpose === "CASE_PAYMENT" && order.consumerUserId && !order.partnerId) {
      const caseIds = (order.caseIds as string[] | null) ?? [];
      const result = await payConsumerCases({
        consumerUserId: order.consumerUserId,
        caseIds,
        actorUserId: order.createdByUserId,
        orderId: order.id,
      });
      return { alreadyProcessed: false as const, purpose: order.purpose, casesPaid: result.casesPaid };
    }

    if (!order.partnerId) {
      throw new Error("Payment order is missing partnerId.");
    }

    if (order.purpose === "WALLET_TOPUP") {
      if (order.walletTransactionId) {
        return { alreadyProcessed: true as const };
      }
      // Same batchId guard as CASE_PAYMENT — survives a failed walletTransactionId link.
      const priorTopup = await prisma.walletTransaction.findFirst({
        where: { partnerId: order.partnerId, batchId: order.id, type: "TOPUP" },
      });
      if (priorTopup) {
        await prisma.walletTopupOrder.update({
          where: { id: order.id },
          data: { walletTransactionId: priorTopup.id },
        });
        return {
          alreadyProcessed: true as const,
          purpose: order.purpose,
          balanceAfter: priorTopup.balanceAfter,
        };
      }
      const txn = await appendWalletTransaction({
        partnerId: order.partnerId,
        type: "TOPUP",
        amount: order.amount.toNumber(),
        batchId: order.id,
        note: `Wallet top-up — order ${order.id}`,
      });
      await prisma.walletTopupOrder.update({
        where: { id: order.id },
        data: { walletTransactionId: txn.id },
      });
      return { alreadyProcessed: false as const, purpose: order.purpose, balanceAfter: txn.balanceAfter };
    }

    const caseIds = (order.caseIds as string[] | null) ?? [];
    // Idempotent credit: a prior partial failure may have already topped up this order.
    const priorTopup = await prisma.walletTransaction.findFirst({
      where: { partnerId: order.partnerId, batchId: order.id, type: "TOPUP" },
    });
    if (!priorTopup) {
      await appendWalletTransaction({
        partnerId: order.partnerId,
        type: "TOPUP",
        amount: order.amount.toNumber(),
        batchId: order.id,
        note: `Direct online payment — order ${order.id} (credited then spent on ${caseIds.length} case(s) below)`,
      });
    }
    const result = await payCasesFromWallet({
      partnerId: order.partnerId,
      caseIds,
      actorUserId: order.createdByUserId,
    });
    // Stripe charged but nothing debited (e.g. cases cancelled before webhook) — credit sits in wallet.
    if (result.casesPaid === 0 && process.env.OPS_ALERT_EMAIL) {
      await notify({
        partnerId: null,
        toEmail: process.env.OPS_ALERT_EMAIL,
        channel: "EMAIL",
        subject: `Online case payment credited with 0 cases paid — order ${order.id}`,
        body: `Partner ${order.partnerId} was charged for order ${order.id}, but no PENDING_PAYMENT cases were debitable. Wallet was topped up; review whether to refund Stripe or leave the credit.`,
      }).catch(() => null);
    }
    return { alreadyProcessed: false as const, purpose: order.purpose, casesPaid: result.casesPaid };
  } catch (err) {
    // Roll back claim so Stripe can retry a clean apply. Side effects above are idempotent.
    await prisma.walletTopupOrder
      .updateMany({
        where: { id: orderId, status: "SUCCESS" },
        data: { status: "PENDING", completedAt: null },
      })
      .catch(() => null);
    throw err;
  }
}

export async function refundCase(params: { caseId: string; note?: string }) {
  const { caseId, note } = params;
  // Idempotent — never double-refund the same case.
  const priorRefund = await prisma.walletTransaction.findFirst({
    where: { referenceCaseId: caseId, type: "REFUND" },
  });
  if (priorRefund) return priorRefund;

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
  }).catch(() => null);
  return txn;
}
