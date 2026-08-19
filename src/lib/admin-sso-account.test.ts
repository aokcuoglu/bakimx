import { expect, mock, test } from "bun:test"

/**
 * BAK-94 + BAK-114 — SSO yetkilendirme kararları.
 *
 * Google yalnız kimliği doğrular; yetkiyi DB verir. Tablo doluyken
 * `PlatformAdmin` satırı olmayan biri giremez; tablo boşken yalnız
 * `ADMIN_EMAILS`'te adı geçen ve `isActive` bir kullanıcı bootstrap'la girer.
 *
 * Ayrı dosya: `mock.module` dosya kapsamındadır (bkz. impersonation-revoke.test.ts).
 */

const EMAIL = "deniz@bakimx.com"
const USER = { id: "user-1", workshopId: "ws-1", isActive: true }

interface DbShape {
  user: { id: string; workshopId: string; isActive: boolean } | null
  admin: { id: string; disabledAt: Date | null } | null
  tableEmpty?: boolean
}

const writes: string[] = []

function mockDb(shape: DbShape) {
  writes.length = 0
  mock.module("@/lib/db", () => ({
    prisma: {
      user: {
        findFirst: async () => shape.user,
        findMany: async () => (shape.user ? [{ id: shape.user.id }] : []),
        create: async () => {
          writes.push("user.create")
          return null
        },
      },
      platformAdmin: {
        findUnique: async ({ where }: { where: { userId: string } }) => {
          if (shape.admin) return shape.admin
          if (writes.includes("platformAdmin.createMany") && shape.user && where.userId === shape.user.id) {
            return { id: "pa-bootstrapped", role: "founder", disabledAt: null }
          }
          return null
        },
        count: async () => (shape.tableEmpty ? 0 : shape.admin ? 1 : 1),
        create: async () => {
          writes.push("platformAdmin.create")
          return null
        },
        createMany: async () => {
          writes.push("platformAdmin.createMany")
          return { count: 1 }
        },
      },
    },
  }))
}

function mockAdminModule(opts: { isInAdminEmails: boolean }) {
  mock.module("@/lib/admin", () => ({
    bootstrapAdminIfEmpty: async (_userId: string, _email: string) => {
      if (!opts.isInAdminEmails) return null
      writes.push("platformAdmin.createMany")
      return { id: "pa-bootstrapped", role: "founder" }
    },
  }))
}

test("PlatformAdmin satırı olan etkin kullanıcı kabul edilir", async () => {
  mockDb({ user: USER, admin: { id: "pa-1", disabledAt: null } })
  mockAdminModule({ isInAdminEmails: false })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result).toEqual({
    ok: true,
    account: { userId: "user-1", workshopId: "ws-1", platformAdminId: "pa-1" },
  })
  expect(writes).toEqual([])
})

test("PlatformAdmin satırı YOK + tablo dolu → giriş yok ve kayıt YARATILMAZ", async () => {
  mockDb({ user: USER, admin: null, tableEmpty: false })
  mock.module("@/lib/admin", () => ({
    bootstrapAdminIfEmpty: async () => null,
  }))
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    expect(result.userId).toBe("user-1")
    expect(result.workshopId).toBe("ws-1")
  }
})

test("erişimi kapatılmış yönetici (disabledAt) giremez", async () => {
  mockDb({ user: USER, admin: { id: "pa-1", disabledAt: new Date() } })
  mockAdminModule({ isInAdminEmails: false })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
})

test("devre dışı kullanıcı hesabı giremez", async () => {
  mockDb({ user: { ...USER, isActive: false }, admin: { id: "pa-1", disabledAt: null } })
  mockAdminModule({ isInAdminEmails: false })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
})

test("hiç kullanıcı satırı olmayan adres giremez ve kiracıya bağlanamaz", async () => {
  mockDb({ user: null, admin: null })
  mockAdminModule({ isInAdminEmails: false })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin("yabanci@bakimx.com")
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    expect(result.workshopId).toBeUndefined()
  }
  expect(writes).toEqual([])
})

test("boş tablo + ADMIN_EMAILS'te adı geçen → SSO bootstrap ile girer", async () => {
  mockDb({ user: USER, admin: null, tableEmpty: true })
  mockAdminModule({ isInAdminEmails: true })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(true)
  if (result.ok) {
    expect(result.account.userId).toBe("user-1")
    expect(result.account.workshopId).toBe("ws-1")
    expect(result.account.platformAdminId).toBe("pa-bootstrapped")
    expect(result.bootstrapped).toBe(true)
  }
})

test("boş tablo + ADMIN_EMAILS'te adı GEÇMEYEN → giremez", async () => {
  mockDb({ user: USER, admin: null, tableEmpty: true })
  mockAdminModule({ isInAdminEmails: false })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    expect(result.userId).toBe("user-1")
  }
})
