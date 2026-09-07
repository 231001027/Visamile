/**
 * Deletes traveler demo applications VM-2026-000001 and VM-2026-000002
 * (and related rows) so the consumer dashboard is empty.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const refs = ["VM-2026-000001", "VM-2026-000002"];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const cases = await prisma.case.findMany({
    where: { referenceNo: { in: refs } },
    select: { id: true, referenceNo: true },
  });
  if (cases.length === 0) {
    console.log("No matching cases found.");
    return;
  }
  const ids = cases.map((c) => c.id);
  console.log("Deleting:", cases.map((c) => c.referenceNo).join(", "));

  await prisma.document.deleteMany({ where: { caseId: { in: ids } } });
  await prisma.caseStatusEvent.deleteMany({ where: { caseId: { in: ids } } });
  await prisma.walletTransaction.updateMany({
    where: { referenceCaseId: { in: ids } },
    data: { referenceCaseId: null },
  });

  // Drop payment orders that only covered these cases
  const orders = await prisma.walletTopupOrder.findMany({
    where: { purpose: "CASE_PAYMENT" },
  });
  for (const o of orders) {
    const orderCaseIds = (o.caseIds as string[] | null) ?? [];
    if (orderCaseIds.length > 0 && orderCaseIds.every((id) => ids.includes(id))) {
      await prisma.walletTopupOrder.delete({ where: { id: o.id } });
    }
  }

  const result = await prisma.case.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${result.count} case(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
