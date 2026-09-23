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
  const isPooler =
    connectionString.includes("pgbouncer=true") ||
    connectionString.includes(":6543/") ||
    connectionString.includes("pooler.supabase");

  const pool = new Pool({
    connectionString,
    // Dev uploads (scan + storage) can take >10s; a single short-lived idle
    // connection gets closed mid-request and Prisma then fails with P1017.
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
    ...(isPooler ? { allowExitOnIdle: false } : {}),
  });

  pool.on("error", (err) => {
    // Idle client errors should not crash the Next.js process.
    console.error("[pg pool]", err.message);
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

const RETRYABLE = new Set(["P1017", "P1001", "P1002", "P1008"]);

function isRetryablePrismaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? String((err as { code?: string }).code) : "";
  if (RETRYABLE.has(code)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /closed the connection|ConnectionClosed|ECONNRESET|connection terminated/i.test(msg);
}

/** Retry after transient Postgres / pooler disconnects (P1017 etc.). */
export async function withPrismaRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryablePrismaError(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw last;
}
