/**
 * Deletes all Document rows and empties the Supabase storage bucket.
 * Also clears PartnerProfile.gstDocumentKey references that pointed at storage.
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
  // Loosen typing — SupabaseClient generics vary by package version.
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
      // Folders have id === null in Supabase list responses
      if (item.id === null) {
        keys.push(...(await listAllKeys(client, path)));
      } else {
        keys.push(path);
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return keys;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const docs = await prisma.document.findMany({ select: { id: true, storageKey: true, fileName: true } });
  console.log(`DB documents: ${docs.length}`);

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bucketKeys = await listAllKeys(client);
  console.log(`Bucket "${bucket}" objects: ${bucketKeys.length}`);

  const toRemove = Array.from(new Set([...docs.map((d) => d.storageKey), ...bucketKeys])).filter(Boolean);
  if (toRemove.length > 0) {
    // remove in chunks of 100
    for (let i = 0; i < toRemove.length; i += 100) {
      const chunk = toRemove.slice(i, i + 100);
      const { error } = await client.storage.from(bucket).remove(chunk);
      if (error) console.warn(`remove chunk failed: ${error.message}`);
      else console.log(`Removed ${chunk.length} object(s) from bucket`);
    }
  } else {
    console.log("Bucket already empty.");
  }

  const deleted = await prisma.document.deleteMany({});
  console.log(`Deleted ${deleted.count} Document row(s).`);

  const clearedGst = await prisma.partner.updateMany({
    where: { gstDocumentKey: { not: null } },
    data: { gstDocumentKey: null },
  });
  console.log(`Cleared ${clearedGst.count} partner GST document key(s).`);
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
