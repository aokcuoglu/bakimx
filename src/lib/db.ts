import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Mutating Prisma operations. Reads are never gated.
const WRITE_OPS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
])

// Control-plane / infra models that must stay writable even inside a read-only
// impersonation session (the stop/revoke flow + audit/observability writes).
const IMPERSONATION_EXEMPT_MODELS = new Set([
  "ImpersonationSession",
  "AuditLog",
  "CommunicationLog",
  "CronRun",
  "ReminderExecutionLog",
  "CalendarSyncLog",
])

/**
 * Global read-only enforcement for founder impersonation. When the current
 * request carries an active read-only overlay, block writes to tenant-data
 * models. Consults the session via cookies() (request-scoped) — outside a
 * request (cron/scripts) getActiveImpersonation() returns null, so writes pass.
 */
function withImpersonationGuard(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (WRITE_OPS.has(operation) && (!model || !IMPERSONATION_EXEMPT_MODELS.has(model))) {
            const { getActiveImpersonation } = await import("@/lib/session")
            const imp = await getActiveImpersonation()
            if (imp?.readOnly) {
              throw new Error("Salt-okunur taklit (impersonation) oturumunda değişiklik yapılamaz.")
            }
          }
          return query(args)
        },
      },
    },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// The query extension is runtime-only (it adds no models/fields), so we expose
// the base PrismaClient type to keep $transaction tx-client types unchanged for
// all existing callers, while the read-only impersonation guard still applies.
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
    ? process.env.DATABASE_URL
    : "postgresql://placeholder:placeholder@localhost:5432/placeholder"
  const pool = new Pool({ connectionString })
  const adapter = new PrismaPg(pool)
  return withImpersonationGuard(new PrismaClient({ adapter })) as unknown as PrismaClient
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma