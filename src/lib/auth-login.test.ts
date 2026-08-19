import { expect, mock, test } from "bun:test"
import bcrypt from "bcryptjs"

/**
 * Giriş çekirdeğinin kullanıcı adı yolu (BAK-40). Prisma sahte bir istemciyle
 * değiştiriliyor: test veritabanı istemez ama `verifyCredentials`'ın GERÇEK
 * kodunu — bcrypt karşılaştırması, isActive/approvalStatus kapıları, jenerik
 * hata mesajı — olduğu gibi çalıştırır.
 */

const PASSWORD = "dogru-sifre"
// Maliyet 8: bcryptjs saf JS ve yavaş; 12 testleri dakikalara çıkarır. Doğrulanan
// davranış maliyetten bağımsız.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 8)

const WORKSHOP = {
  id: "ws-1",
  loginCode: "mehmet-oto",
  approvalStatus: "approved",
  planTier: "pro",
  subscriptionStatus: "active",
  trialEndsAt: null,
  currentPeriodEnd: null,
}

// ws-1'de e-postasız bir usta, ws-2'de AYNI kullanıcı adıyla başka biri:
// kullanıcı adlarının tenant içinde benzersiz olduğunu test eder.
const USERS = [
  {
    id: "u-owner",
    email: "sahip@bakimx.com",
    username: null,
    password: PASSWORD_HASH,
    isActive: true,
    workshopId: "ws-1",
    mustChangePassword: false,
  },
  {
    id: "u-usta",
    email: null,
    username: "ahmet",
    password: PASSWORD_HASH,
    isActive: true,
    workshopId: "ws-1",
    mustChangePassword: true,
  },
  {
    id: "u-other-tenant",
    email: null,
    username: "ahmet",
    password: PASSWORD_HASH,
    isActive: true,
    workshopId: "ws-2",
    mustChangePassword: false,
  },
  {
    id: "u-pasif",
    email: null,
    username: "pasif",
    password: PASSWORD_HASH,
    isActive: false,
    workshopId: "ws-1",
    mustChangePassword: false,
  },
]

type UserWhere = {
  email?: string
  workshopId_username?: { workshopId: string; username: string }
}

mock.module("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: async ({ where }: { where: UserWhere }) => {
        if (where.email) return USERS.find((u) => u.email === where.email) ?? null
        const key = where.workshopId_username
        if (!key) return null
        return (
          USERS.find((u) => u.workshopId === key.workshopId && u.username === key.username) ?? null
        )
      },
    },
    workshop: {
      findUnique: async ({ where }: { where: { id?: string; loginCode?: string } }) => {
        if (where.loginCode) return where.loginCode === WORKSHOP.loginCode ? WORKSHOP : null
        // ws-2 de var olsun ki diğer tenant'ın girişi "iş yeri yok"a düşmesin.
        if (where.id === "ws-1") return WORKSHOP
        if (where.id === "ws-2") return { ...WORKSHOP, id: "ws-2", loginCode: "ikinci-oto" }
        return null
      },
    },
  },
}))

const {
  INVALID_CREDENTIALS_MESSAGE,
  loginAccountRateLimit,
  loginRateLimit,
  resolveWorkshopIdByLoginCode,
  verifyCredentials,
} = await import("./auth-login")

test("kullanıcı adı + doğru şifre: e-postasız kullanıcı giriş yapabilir", async () => {
  const result = await verifyCredentials({
    identifier: "ahmet",
    password: PASSWORD,
    workshopId: "ws-1",
  })

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.userId).toBe("u-usta")
  expect(result.workshopId).toBe("ws-1")
  // Geçici şifreyle girildi — çağıran taraf şifre değiştirmeye yönlendirir.
  expect(result.mustChangePassword).toBe(true)
  expect(result.planExpiredReason).toBeNull()
})

test("kullanıcı adı + yanlış şifre: jenerik hata", async () => {
  const result = await verifyCredentials({
    identifier: "ahmet",
    password: "yanlis-sifre",
    workshopId: "ws-1",
  })

  expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS_MESSAGE })
})

test("bilinmeyen kullanıcı adı, yanlış şifreyle aynı hatayı verir", async () => {
  const unknown = await verifyCredentials({
    identifier: "boyle-biri-yok",
    password: PASSWORD,
    workshopId: "ws-1",
  })
  const wrongPassword = await verifyCredentials({
    identifier: "ahmet",
    password: "yanlis-sifre",
    workshopId: "ws-1",
  })

  // Kullanıcı adı enumerasyonu yok: iki yol da birebir aynı mesaja çıkar.
  expect(unknown).toEqual(wrongPassword)
}, 30_000)

test("kullanıcı adları tenant içinde benzersiz: kod hangi hesabı açtığını belirler", async () => {
  const first = await verifyCredentials({
    identifier: "ahmet",
    password: PASSWORD,
    workshopId: "ws-1",
  })
  const second = await verifyCredentials({
    identifier: "ahmet",
    password: PASSWORD,
    workshopId: "ws-2",
  })

  expect(first.ok && first.userId).toBe("u-usta")
  expect(second.ok && second.userId).toBe("u-other-tenant")
})

test("iş yeri kodu çözülmemişse kullanıcı adı yolu eşleşmez", async () => {
  const result = await verifyCredentials({ identifier: "ahmet", password: PASSWORD })
  expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS_MESSAGE })
}, 30_000)

test("pasif koltuk kullanıcı adı yolunda da giriş yapamaz", async () => {
  const result = await verifyCredentials({
    identifier: "pasif",
    password: PASSWORD,
    workshopId: "ws-1",
  })
  expect(result).toEqual({ ok: false, error: INVALID_CREDENTIALS_MESSAGE })
})

test("e-posta yolu değişmeden çalışır (workshopId gerekmez)", async () => {
  const result = await verifyCredentials({
    identifier: "sahip@bakimx.com",
    password: PASSWORD,
  })

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.userId).toBe("u-owner")
  expect(result.mustChangePassword).toBe(false)
})

test("iş yeri kodu çözümlemesi: geçersiz/bilinmeyen kod null döner", async () => {
  expect(await resolveWorkshopIdByLoginCode("mehmet-oto")).toBe("ws-1")
  expect(await resolveWorkshopIdByLoginCode("  MEHMET-OTO ")).toBe("ws-1")
  expect(await resolveWorkshopIdByLoginCode("bilinmeyen-kod")).toBeNull()
  expect(await resolveWorkshopIdByLoginCode("ab")).toBeNull() // format geçersiz
  expect(await resolveWorkshopIdByLoginCode("admin")).toBeNull() // rezerve
})

test("hesap bazlı limit: bir ustanın hatalı denemeleri ekibi kilitlemez", async () => {
  // Aynı atölye (aynı IP) — kovalar `(workshopId, kullanıcı adı)` başına ayrı.
  for (let i = 0; i < 8; i++) {
    expect((await loginAccountRateLimit("ahmet", "ws-rl")).allowed).toBe(true)
  }
  const blocked = await loginAccountRateLimit("ahmet", "ws-rl")
  expect(blocked.allowed).toBe(false)
  expect(blocked.retryAfterMs).toBeGreaterThan(0)

  // Yan masadaki usta hiç etkilenmez.
  expect((await loginAccountRateLimit("mehmet", "ws-rl")).allowed).toBe(true)
  // Başka atölyedeki aynı isimli kullanıcı da ayrı kovadadır.
  expect((await loginAccountRateLimit("ahmet", "ws-rl-2")).allowed).toBe(true)
})

test("e-posta kimliği tenant'tan bağımsız tek kovadır", async () => {
  for (let i = 0; i < 8; i++) {
    expect((await loginAccountRateLimit("kilit@bakimx.com", null)).allowed).toBe(true)
  }
  expect((await loginAccountRateLimit("kilit@bakimx.com", null)).allowed).toBe(false)
  // workshopId verilse bile aynı kova — e-posta global benzersiz.
  expect((await loginAccountRateLimit("kilit@bakimx.com", "ws-rl")).allowed).toBe(false)
})

test("IP limiti paylaşımlı atölye wifi'sini taşır", async () => {
  // 8'de kesseydi tek atölyeden giren 6 usta birbirini kilitlerdi.
  for (let i = 0; i < 40; i++) {
    expect((await loginRateLimit("203.0.113.7")).allowed).toBe(true)
  }
  expect((await loginRateLimit("203.0.113.7")).allowed).toBe(false)
})
