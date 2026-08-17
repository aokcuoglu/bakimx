import { describe, expect, test } from "bun:test"
import {
  QUIET_WINDOW_MS,
  buildVisitorMessageEmail,
  notifyAdminsOfVisitorMessage,
  startsNewBurst,
} from "./notify"

const NOW = new Date("2026-08-17T12:00:00.000Z")

function minutesAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 60_000)
}

describe("startsNewBurst", () => {
  test("yeni görüşme her zaman bildirilir", () => {
    expect(
      startsNewBurst({ isNew: true, previousVisitorMessageAt: minutesAgo(1), lastAgentMessageAt: null, now: NOW }),
    ).toBe(true)
  })

  test("önceki ziyaretçi mesajı yoksa bildirilir", () => {
    expect(
      startsNewBurst({ isNew: false, previousVisitorMessageAt: null, lastAgentMessageAt: null, now: NOW }),
    ).toBe(true)
  })

  test("temsilci araya yanıt verdiyse geri dönen mesaj yeni yığındır", () => {
    expect(
      startsNewBurst({
        isNew: false,
        previousVisitorMessageAt: minutesAgo(10),
        lastAgentMessageAt: minutesAgo(5),
        now: NOW,
      }),
    ).toBe(true)
  })

  test("ardışık mesajlar tek e-posta ile geçilir", () => {
    expect(
      startsNewBurst({
        isNew: false,
        previousVisitorMessageAt: minutesAgo(1),
        lastAgentMessageAt: null,
        now: NOW,
      }),
    ).toBe(false)
  })

  test("temsilci yanıtı önceki ziyaretçi mesajından ESKİYSE yığın sürüyor sayılır", () => {
    expect(
      startsNewBurst({
        isNew: false,
        previousVisitorMessageAt: minutesAgo(2),
        lastAgentMessageAt: minutesAgo(30),
        now: NOW,
      }),
    ).toBe(false)
  })

  test("sessizlik penceresi aşılınca yeni yığın başlar", () => {
    const justOver = new Date(NOW.getTime() - QUIET_WINDOW_MS - 1_000)
    expect(
      startsNewBurst({ isNew: false, previousVisitorMessageAt: justOver, lastAgentMessageAt: null, now: NOW }),
    ).toBe(true)
  })

  test("pencerenin tam sınırı henüz yeni yığın değildir", () => {
    const exactly = new Date(NOW.getTime() - QUIET_WINDOW_MS)
    expect(
      startsNewBurst({ isNew: false, previousVisitorMessageAt: exactly, lastAgentMessageAt: null, now: NOW }),
    ).toBe(false)
  })
})

describe("buildVisitorMessageEmail", () => {
  const base = {
    visitorName: "Ayşe Yılmaz",
    visitorEmail: "ayse@example.com",
    visitorPhone: "05551112233",
    body: "Merhaba, fiyatları öğrenebilir miyim?",
    pageUrl: "https://bakimx.com/fiyatlar",
    startedOffline: false,
    isNew: true,
  }

  test("mesai içi ve mesai dışı konu satırları ayrışır", () => {
    expect(buildVisitorMessageEmail(base).subject).toBe("Canlı destek mesajı — Ayşe Yılmaz")
    expect(buildVisitorMessageEmail({ ...base, startedOffline: true }).subject).toBe(
      "Mesai dışı canlı destek mesajı — Ayşe Yılmaz",
    )
  })

  test("ziyaretçi metni HTML olarak yorumlanmaz", () => {
    const { html } = buildVisitorMessageEmail({
      ...base,
      visitorName: "<script>alert(1)</script>",
      body: "<img src=x onerror=alert(1)>",
    })
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("<img src=x onerror=alert(1)>")
    expect(html).toContain("&lt;script&gt;")
  })

  test("satır sonları korunur", () => {
    const { html } = buildVisitorMessageEmail({ ...base, body: "birinci\nikinci" })
    expect(html).toContain("birinci<br />ikinci")
  })

  test("telefon ve sayfa yoksa o satırlar hiç basılmaz", () => {
    const { html } = buildVisitorMessageEmail({ ...base, visitorPhone: null, pageUrl: null })
    expect(html).not.toContain("Telefon")
    expect(html).not.toContain("Hangi sayfadan")
    expect(html).toContain("ayse@example.com")
  })

  test("gelen kutusuna CTA verir", () => {
    expect(buildVisitorMessageEmail(base).html).toContain("/admin/live-chat")
  })
})

describe("notifyAdminsOfVisitorMessage", () => {
  const n = {
    visitorName: "Ayşe",
    visitorEmail: "ayse@example.com",
    visitorPhone: null,
    body: "selam",
    pageUrl: null,
    startedOffline: false,
    isNew: true,
  }

  test("ADMIN_EMAILS boşsa hiç gönderim denemez", async () => {
    let calls = 0
    const result = await notifyAdminsOfVisitorMessage(n, {
      recipients: () => [],
      send: async () => {
        calls += 1
        return { success: true }
      },
    })
    expect(result.sent).toBe(0)
    expect(calls).toBe(0)
  })

  test("her yöneticiye ayrı ayrı gider", async () => {
    const seen: string[] = []
    const result = await notifyAdminsOfVisitorMessage(n, {
      recipients: () => ["a@bakimx.com", "b@bakimx.com"],
      send: async (to) => {
        seen.push(to)
        return { success: true }
      },
    })
    expect(seen).toEqual(["a@bakimx.com", "b@bakimx.com"])
    expect(result.sent).toBe(2)
  })

  test("bir adres başarısız olursa diğerleri yine denenir", async () => {
    const result = await notifyAdminsOfVisitorMessage(n, {
      recipients: () => ["a@bakimx.com", "b@bakimx.com"],
      send: async (to) => (to === "a@bakimx.com" ? { success: false, error: "bounce" } : { success: true }),
    })
    expect(result.sent).toBe(1)
  })

  test("sağlayıcı throw ederse ziyaretçi akışı etkilenmez", async () => {
    const result = await notifyAdminsOfVisitorMessage(n, {
      recipients: () => ["a@bakimx.com"],
      send: async () => {
        throw new Error("network down")
      },
    })
    expect(result.sent).toBe(0)
  })
})
