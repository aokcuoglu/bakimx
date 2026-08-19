import { afterEach, expect, mock, test } from "bun:test"

/**
 * BAK-94 — **otomatik hesap açma yok** + BAK-114 — **boş tabloda env bootstrap.**
 *
 * Google yalnız kimliği doğrular; yetkiyi DB verir. Bu dosya iki kuralı birden
 * sabitler:
 *
 * 1. Doğrulanmış bir `bakimx.com` adresi `PlatformAdmin` satırı olmadan konsola
 *    giremez ve kendine kayıt yaratamaz. Bu kural düşerse bakimx.com uzantılı her
 *    adres ilk girişte kendine konsol erişimi açar.
 * 2. Tablo BOŞKEN `ADMIN_EMAILS` bootstrap'ı SSO yolunda da çalışır (BAK-114).
 *    Çalışmadığı sürece `/admin-login` kendi kendine açılamayan bir kapıydı:
 *    açılması için önce şifreli yoldan geçmek gerekiyordu.
 *
 * Ayrı dosya: `mock.module` dosya kapsamındadır (bkz. impersonation-revoke.test.ts).
 */

const EMAIL = "deniz@bakimx.com"
const USER = { id: "user-1", email: EMAIL, workshopId: "ws-1", isActive: true }

interface DbShape {
  user: { id: string; email: string; workshopId: string; isActive: boolean } | null
  admin: { id: string; disabledAt: Date | null } | null
  /** `PlatformAdmin` satır sayısı — bootstrap YALNIZ 0 iken devreye girer. */
  adminCount?: number
  /** Bootstrap'ın yazacağı kullanıcılar (`ADMIN_EMAILS` ∩ `User`). */
  bootstrapUsers?: { id: string }[]
}

const writes: string[] = []
const envBackup = process.env.ADMIN_EMAILS

afterEach(() => {
  if (envBackup === undefined) delete process.env.ADMIN_EMAILS
  else process.env.ADMIN_EMAILS = envBackup
})

function mockDb(shape: DbShape) {
  writes.length = 0
  // Bootstrap yazdıktan SONRA ikinci findUnique gerçek satırı görmeli.
  let admin = shape.admin

  mock.module("@/lib/db", () => ({
    prisma: {
      user: {
        findFirst: async () => shape.user,
        findMany: async () => shape.bootstrapUsers ?? [],
        create: async () => {
          writes.push("user.create")
          return null
        },
      },
      platformAdmin: {
        findUnique: async () => admin,
        count: async () => shape.adminCount ?? 0,
        create: async () => {
          writes.push("platformAdmin.create")
          return null
        },
        createMany: async () => {
          writes.push("platformAdmin.createMany")
          admin = { id: "pa-bootstrap", disabledAt: null }
          return null
        },
      },
    },
  }))
}

test("PlatformAdmin satırı olan etkin kullanıcı kabul edilir", async () => {
  process.env.ADMIN_EMAILS = ""
  mockDb({ user: USER, admin: { id: "pa-1", disabledAt: null }, adminCount: 1 })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result).toEqual({
    ok: true,
    account: {
      userId: "user-1",
      workshopId: "ws-1",
      platformAdminId: "pa-1",
      viaEnvBootstrap: false,
    },
  })
  expect(writes).toEqual([])
})

test("PlatformAdmin satırı YOKSA giriş yok ve kayıt YARATILMAZ", async () => {
  process.env.ADMIN_EMAILS = ""
  mockDb({ user: USER, admin: null, adminCount: 1 })
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
  process.env.ADMIN_EMAILS = EMAIL
  mockDb({ user: USER, admin: { id: "pa-1", disabledAt: new Date() }, adminCount: 1 })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
  // Kapatılmış satır varken env listesi onu geri açmaz.
  expect(writes).toEqual([])
})

test("devre dışı kullanıcı hesabı giremez", async () => {
  process.env.ADMIN_EMAILS = EMAIL
  mockDb({ user: { ...USER, isActive: false }, admin: { id: "pa-1", disabledAt: null }, adminCount: 1 })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
})

test("hiç kullanıcı satırı olmayan adres giremez ve kiracıya bağlanamaz", async () => {
  process.env.ADMIN_EMAILS = "yabanci@bakimx.com"
  mockDb({ user: null, admin: null, adminCount: 0 })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin("yabanci@bakimx.com")
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    expect(result.workshopId).toBeUndefined()
  }
  expect(writes).toEqual([])
})

test("BAK-114: tablo BOŞ + adres ADMIN_EMAILS'te → giriş açılır ve satır yazılır", async () => {
  process.env.ADMIN_EMAILS = `baska@bakimx.com, ${EMAIL.toUpperCase()}`
  mockDb({ user: USER, admin: null, adminCount: 0, bootstrapUsers: [{ id: "user-1" }] })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result).toEqual({
    ok: true,
    account: {
      userId: "user-1",
      workshopId: "ws-1",
      platformAdminId: "pa-bootstrap",
      viaEnvBootstrap: true,
    },
  })
  expect(writes).toEqual(["platformAdmin.createMany"])
})

test("BAK-114: tablo DOLU + adres ADMIN_EMAILS'te ama satırı yok → reddedilir", async () => {
  process.env.ADMIN_EMAILS = EMAIL
  mockDb({ user: USER, admin: null, adminCount: 3, bootstrapUsers: [{ id: "user-1" }] })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("no_admin_account")
  // Offboarding tek noktadan (DB) yapılabilsin: env dolu tabloda hüküm vermez.
  expect(writes).toEqual([])
})

test("BAK-114: tablo BOŞ ama adres ADMIN_EMAILS'te DEĞİL → giremez, kayıt yaratılmaz", async () => {
  process.env.ADMIN_EMAILS = "baskasi@bakimx.com"
  mockDb({ user: USER, admin: null, adminCount: 0, bootstrapUsers: [{ id: "user-2" }] })
  const { resolveSsoAdmin } = await import("./admin-sso")

  const result = await resolveSsoAdmin(EMAIL)
  expect(result.ok).toBe(false)
  if (!result.ok) {
    expect(result.reason).toBe("no_admin_account")
    expect(result.userId).toBe("user-1")
  }
  expect(writes).toEqual([])
})
