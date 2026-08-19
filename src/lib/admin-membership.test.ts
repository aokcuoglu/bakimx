import { afterEach, expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * BAK-114 — platform üyeliği TEK kaynaktan çözülür.
 *
 * İki giriş yolu (şifreli giriş ve Google SSO callback'i) aynı soruyu soruyor.
 * Ayrı ayrı cevapladıklarında ayrıştılar: SSO env bootstrap'ını çalıştırmıyordu ve
 * `PlatformAdmin` tablosu boşken `/admin-login` kimseyi içeri alamıyordu. Bu dosya
 * hem kararın kendisini hem de "iki yol da buradan geçer" kuralını sabitler.
 */

const envBackup = process.env.ADMIN_EMAILS
const writes: string[] = []

afterEach(() => {
  if (envBackup === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = envBackup
})

interface DbShape {
  admin: { id: string; role: string; disabledAt: Date | null; sessionsValidFrom: Date | null } | null
  adminCount?: number
  bootstrapUsers?: { id: string }[]
}

function mockDb(shape: DbShape) {
  writes.length = 0
  let admin = shape.admin

  mock.module("@/lib/db", () => ({
    prisma: {
      user: {
        findMany: async () => shape.bootstrapUsers ?? [],
      },
      platformAdmin: {
        findUnique: async () => admin,
        count: async () => shape.adminCount ?? 0,
        createMany: async () => {
          writes.push("createMany")
          admin = { id: "pa-boot", role: "founder", disabledAt: null, sessionsValidFrom: null }
          return null
        },
      },
    },
  }))
}

const USER = { id: "user-1", email: "deniz@bakimx.com" }

test("DB satırı varsa rolü ve iptal damgası olduğu gibi döner", async () => {
  process.env.ADMIN_EMAILS = ""
  const validFrom = new Date("2026-08-19T00:00:00Z")
  mockDb({ admin: { id: "pa-1", role: "support", disabledAt: null, sessionsValidFrom: validFrom }, adminCount: 1 })
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership(USER)).toEqual({
    adminRole: "support",
    platformAdminId: "pa-1",
    sessionsValidFrom: validFrom,
    viaEnvBootstrap: false,
  })
  expect(writes).toEqual([])
})

test("erişimi kapatılmış satır (disabledAt) reddedilir", async () => {
  process.env.ADMIN_EMAILS = USER.email
  mockDb({ admin: { id: "pa-1", role: "founder", disabledAt: new Date(), sessionsValidFrom: null }, adminCount: 1 })
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership(USER)).toBeNull()
  expect(writes).toEqual([])
})

test("tablo BOŞ + adres ADMIN_EMAILS'te → founder olarak bootstrap edilir", async () => {
  process.env.ADMIN_EMAILS = ` ${USER.email.toUpperCase()} ,baska@bakimx.com`
  mockDb({ admin: null, adminCount: 0, bootstrapUsers: [{ id: "user-1" }] })
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership(USER)).toEqual({
    adminRole: "founder",
    platformAdminId: "pa-boot",
    sessionsValidFrom: null,
    viaEnvBootstrap: true,
  })
  expect(writes).toEqual(["createMany"])
})

test("tablo DOLU + adres ADMIN_EMAILS'te ama satırı yok → reddedilir", async () => {
  process.env.ADMIN_EMAILS = USER.email
  mockDb({ admin: null, adminCount: 2, bootstrapUsers: [{ id: "user-1" }] })
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership(USER)).toBeNull()
  expect(writes).toEqual([])
})

test("tablo BOŞ ama adres listede değil → reddedilir, hiçbir şey yazılmaz", async () => {
  process.env.ADMIN_EMAILS = "baskasi@bakimx.com"
  mockDb({ admin: null, adminCount: 0, bootstrapUsers: [{ id: "user-9" }] })
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership(USER)).toBeNull()
  expect(writes).toEqual([])
})

test("e-postası olmayan kullanıcı yönetici olamaz", async () => {
  process.env.ADMIN_EMAILS = USER.email
  mockDb({ admin: { id: "pa-1", role: "founder", disabledAt: null, sessionsValidFrom: null }, adminCount: 1 })
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership({ id: "user-1", email: null })).toBeNull()
})

test("bootstrap yazması düşerse giriş engellenmez (satır id'si null döner)", async () => {
  process.env.ADMIN_EMAILS = USER.email
  mock.module("@/lib/db", () => ({
    prisma: {
      user: { findMany: async () => [{ id: "user-1" }] },
      platformAdmin: {
        findUnique: async () => null,
        count: async () => 0,
        createMany: async () => {
          throw new Error("db down")
        },
      },
    },
  }))
  const { resolveAdminMembership } = await import("./admin-membership")

  expect(await resolveAdminMembership(USER)).toEqual({
    adminRole: "founder",
    platformAdminId: null,
    sessionsValidFrom: null,
    viaEnvBootstrap: true,
  })
})

/**
 * Kaynak tarayan kapı: üyelik kararı `admin-membership.ts` dışında verilirse iki
 * yol yeniden ayrışır — BAK-114'ün kök nedeni tam olarak buydu.
 */
test("giriş yolları PlatformAdmin tablosunu doğrudan okumaz", () => {
  for (const file of ["admin.ts", "admin-sso.ts"]) {
    const source = readFileSync(join(import.meta.dir, file), "utf8")
    expect(source, `${file} üyeliği kendi başına çözüyor`).not.toInclude("prisma.platformAdmin")
    expect(source, `${file} ortak yardımcıyı çağırmıyor`).toInclude("resolveAdminMembership")
  }
})
