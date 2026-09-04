import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function buildPool() {
  if (globalForPrisma.pgPool) return globalForPrisma.pgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  // Supabase (direct or pooler) needs relaxed TLS in Node; Vercel cannot
  // reliably reach db.*.supabase.co:5432 (IPv6) — use the pooler URL in prod.
  const isSupabase =
    connectionString.includes("supabase.co") || connectionString.includes("supabase.com");

  const pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    // PgBouncer transaction pool (port 6543) does not support prepared statements.
    ...(connectionString.includes("pgbouncer=true") || connectionString.includes(":6543/")
      ? { allowExitOnIdle: true }
      : {}),
  });

  globalForPrisma.pgPool = pool;
  return pool;
}

function buildClient() {
  const adapter = new PrismaPg(buildPool());
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? buildClient();
globalForPrisma.prisma = prisma;
