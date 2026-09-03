import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Uses Prisma's driver-adapters mode (see schema.prisma previewFeatures):
// queries run through the `pg` driver directly rather than a downloaded
// native query-engine binary. This is also the pattern you want for
// serverless/edge deployments (Vercel, etc.) since there's no binary to
// bundle per-platform.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function buildClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
