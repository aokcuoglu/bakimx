/**
 * BAK-96 — iptal edilmiş bir taklit oturumu kiracı verisine ERİŞEMEZ.
 *
 * Regresyonun şekli: overlay çerezde durur ve `expiresAt` epoch'u DB'ye gitmeden
 * çözülür. `revokedAt` yazıldığında çerez DEĞİŞMEZ; iptalin bir hükmü olması
 * yalnız `getCurrentUser()` içindeki DB kontrolüne bağlıdır. O kontrol düşerse
 * bu dosya kırmızıya döner — ekran açmadan.
 *
 * Ayrı dosya: mock'lar dosya kapsamındadır (bkz. auth-session-errors.test.ts).
 */
import { test, expect, mock } from "bun:test"

const ADMIN = { id: "admin-1", workshopId: "ws-admin" }
const TARGET = { id: "target-1", workshopId: "ws-tenant" }

const overlay = {
  adminUserId: ADMIN.id,
  targetUserId: TARGET.id,
  targetWorkshopId: TARGET.workshopId,
  sessionId: "imp-1",
  // Süre DOLMAMIŞ — tek kapı zaman aşımı olsaydı bu overlay geçerli sayılırdı.
  expiresAt: Date.now() + 10 * 60_000,
  readOnly: true,
}

mock.module("@/lib/session", () => ({
  getSession: async () => ({ userId: ADMIN.id, workshopId: ADMIN.workshopId }),
  getImpersonationOverlay: async () => overlay,
}))

function mockDb(impersonationRow: { endedAt: Date | null; revokedAt: Date | null } | null) {
  mock.module("@/lib/db", () => ({
    prisma: {
      impersonationSession: { findUnique: async () => impersonationRow },
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === TARGET.id
            ? { ...TARGET, email: "t@x.com", username: null, firstName: null, lastName: null, role: "owner", isActive: true, mustChangePassword: false, technicianId: null, workshop: { kind: "customer" } }
            : { ...ADMIN, email: "a@x.com", username: null, firstName: null, lastName: null, role: "owner", isActive: true, mustChangePassword: false, technicianId: null, workshop: { kind: "customer" } },
      },
    },
  }))
}

test("iptal edilmiş oturum kiracı verisine erişemez — etkin kimlik yöneticiye döner", async () => {
  mockDb({ endedAt: null, revokedAt: new Date() })
  const { getCurrentUser } = await import("./auth")

  const user = await getCurrentUser()
  expect(user?.id).toBe(ADMIN.id)
  expect(user?.workshopId).toBe(ADMIN.workshopId)
  expect(user?.impersonatorAdminId).toBeUndefined()
})

test("DB satırı yoksa fail-closed — overlay yok sayılır", async () => {
  mockDb(null)
  const { isImpersonationRevoked } = await import("./impersonation")
  expect(await isImpersonationRevoked("imp-1")).toBe(true)
})

test("kapatılmış (endedAt) oturum da iptal sayılır", async () => {
  mockDb({ endedAt: new Date(), revokedAt: null })
  const { isImpersonationRevoked } = await import("./impersonation")
  expect(await isImpersonationRevoked("imp-1")).toBe(true)
})

test("açık oturum geçerlidir — etkin kimlik hedef kiracıdır", async () => {
  mockDb({ endedAt: null, revokedAt: null })
  const { getCurrentUser } = await import("./auth")

  const user = await getCurrentUser()
  expect(user?.id).toBe(TARGET.id)
  expect(user?.workshopId).toBe(TARGET.workshopId)
  expect(user?.impersonatorAdminId).toBe(ADMIN.id)
})
