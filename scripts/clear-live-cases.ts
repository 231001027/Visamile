/**
 * Clears live operational data created during demos/testing:
 * cases, documents, status history, case payment orders.
 * Keeps users, partners, processors, countries, visa types, and rates.
 *
 * Usage: npx tsx scripts/clear-live-cases.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const bucket = process.env.SUPABASE_STORAGE_BUCKET || "documents";

async function listAllKeys(
  client: { storage: { from: (b: string) => any } },
  prefix = ""
): Promise<string[]> {
  const keys: string[] = [];
  const pageSize = 100;
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) keys.push(...(await listAllKeys(client, path)));
      else keys.push(path);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return keys;
}

async function main() {
  const cases = await prisma.case.findMany({ select: { id: true, referenceNo: true } });
  console.log(`Cases found: ${cases.length}`);
  if (cases.length) console.log(cases.map((c) => c.referenceNo).join(", "));

  const ids = cases.map((c) => c.id);

  // Storage bucket first (use DB keys + full bucket list)
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const docs = await prisma.document.findMany({ select: { storageKey: true } });
    const bucketKeys = await listAllKeys(client);
    const toRemove = Array.from(new Set([...docs.map((d) => d.storageKey), ...bucketKeys])).filter(Boolean);
    console.log(`Storage objects to remove: ${toRemove.length}`);
    for (let i = 0; i < toRemove.length; i += 100) {
      const chunk = toRemove.slice(i, i + 100);
      const { error } = await client.storage.from(bucket).remove(chunk);
      if (error) console.warn(`bucket remove failed: ${error.message}`);
      else console.log(`Removed ${chunk.length} file(s) from bucket`);
    }
  } else {
    console.warn("Skipping bucket clear (SUPABASE_URL / SERVICE_ROLE_KEY missing).");
  }

  const docsDeleted = await prisma.document.deleteMany({});
  console.log(`Deleted documents: ${docsDeleted.count}`);

  if (ids.length > 0) {
    await prisma.caseStatusEvent.deleteMany({ where: { caseId: { in: ids } } });
    await prisma.walletTransaction.updateMany({
      where: { referenceCaseId: { in: ids } },
      data: { referenceCaseId: null },
    });
  } else {
    await prisma.caseStatusEvent.deleteMany({});
  }

  const casePayOrders = await prisma.walletTopupOrder.deleteMany({
    where: { purpose: "CASE_PAYMENT" },
  });
  console.log(`Deleted CASE_PAYMENT orders: ${casePayOrders.count}`);

  const casesDeleted = await prisma.case.deleteMany({});
  console.log(`Deleted cases: ${casesDeleted.count}`);

  // Reset case reference sequence so next case starts clean for this year
  const year = new Date().getFullYear();
  const seqKey = `case_ref_${year}`;
  try {
    await prisma.idSequence.upsert({
      where: { name: seqKey },
      create: { name: seqKey, value: 0 },
      update: { value: 0 },
    });
    console.log(`Reset IdSequence ${seqKey} to 0.`);
  } catch (e) {
    console.warn("Could not reset IdSequence:", e instanceof Error ? e.message : e);
  }

  await prisma.partner.updateMany({
    where: { gstDocumentKey: { not: null } },
    data: { gstDocumentKey: null },
  });

  console.log("Done. Catalog, users, and partners kept.");
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
