import { expect, mock, test } from "bun:test"

/**
 * BAK-94 — **otomatik hesap açma yok.**
 *
 * Google yalnız kimliği doğrular; yetkiyi DB verir. Bu dosya, doğrulanmış bir
 * `bakimx.com` adresinin `PlatformAdmin` satırı olmadan konsola giremediğini ve
 * kendine kayıt yaratmadığını sabitler. Bu kural düşerse bakimx.com uzantılı her
 * adres ilk girişte kendine konsol erişimi açar.
 *
 * Ayrı dosya: `mock.module` dosya kapsamındadır (bkz. impersonation-revoke.test.ts).
 */

const EMAIL = "deniz@bakimx.com"
const USER = { id: "user-1", workshopId: "ws-1", isActive: true }

interface DbShape {
  user: { id: string; workshopId: string; isActive: boolean } | null
  admin: { id: string; disabledAt: Date | null } | null
}

const writes: string[] = []

function mockDb(shape: DbShape) {
  writes.length = 0
  mock.module("@/lib/db", () => ({
    prisma: {
      user: {
        findFirst: async () => shape.user,
        create: async () => {
          writes.push("user.create")
          return null
        },
      },
      platformAdmin: {
        findUnique: async () => shape.admin,
        create: async () => {
          writes.push("platformAdmin.create")
          return null
        },
        createMany: async () => {
          writes.push("platformAdmin.createMany")
          return null
        },
      },
    },
  }))
}

test("PlatformAdmin satırı olan etkin kullanıcı kabul edilir", async () => {
  mockDb({ user: USER, admin: { id: "pa-1", disabledAt: null } })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result).toEqual({
    ok: true,
    account: { userId: "user-1", workshopId: "ws-1", platformAdminId: "pa-1" },
  })
  expect(writes).toEqual([])
})

test("PlatformAdmin satırı YOKSA giriş yok ve kayıt YARATILMAZ", async () => {
  mockDb({ user: USER, admin: null })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    // Denetim kaydı kiracıya bağlı olduğu için kimlik geri döner.
    expect(result.userId).toBe("user-1")
    expect(result.workshopId).toBe("ws-1")
  }
  expect(writes).toEqual([])
})

test("erişimi kapatılmış yönetici (disabledAt) giremez", async () => {
  mockDb({ user: USER, admin: { id: "pa-1", disabledAt: new Date() } })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
})

test("devre dışı kullanıcı hesabı giremez", async () => {
  mockDb({ user: { ...USER, isActive: false }, admin: { id: "pa-1", disabledAt: null } })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
})

test("hiç kullanıcı satırı olmayan adres giremez ve kiracıya bağlanamaz", async () => {
  mockDb({ user: null, admin: null })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin("yabanci@bakimx.com")
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    expect(result.workshopId).toBeUndefined()
  }
  expect(writes).toEqual([])
})
