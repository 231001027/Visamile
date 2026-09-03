import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Uses Prisma's driver-adapters mode (see schema.prisma previewFeatures):
// queries run through the `pg` driver directly rather than a downloaded
// native query-engine binary. This is also the pattern you want for
// serverless/edge deployments (Vercel, etc.) since there's no binary to
// bundle per-platform.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient() {
  // Supabase pooler / transit TLS often needs rejectUnauthorized: false
  // with the node-pg driver (self-signed intermediate in the chain).
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
