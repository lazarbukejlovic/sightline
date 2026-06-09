import { PrismaClient } from "@prisma/client";

/**
 * Server-only Prisma client (singleton across hot reloads).
 *
 * Prisma connects with a privileged role that BYPASSES Postgres RLS, so it must
 * only ever be used inside server code that has already resolved and verified
 * the caller's org_id, and every query must be scoped by it
 * (see src/lib/org-scope.ts). Never import this into a Client Component.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
