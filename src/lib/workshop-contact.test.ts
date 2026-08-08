import { expect, test, describe } from "bun:test"
import {
  buildWorkshopContactEntries,
  hasWorkshopContactInfo,
  normalizeContactNumber,
  normalizeSocialUrl,
  pickWorkshopPublicContact,
} from "./workshop-contact"

describe("normalizeSocialUrl", () => {
  test("şemasız adrese https ekler", () => {
    expect(normalizeSocialUrl("instagram.com/kizildagoto")).toBe("https://instagram.com/kizildagoto")
    expect(normalizeSocialUrl("  www.facebook.com/kizildagoto  ")).toBe("https://www.facebook.com/kizildagoto")
  })

  test("mevcut http/https şemasını korur", () => {
    expect(normalizeSocialUrl("http://x.com/kizildagoto")).toBe("http://x.com/kizildagoto")
    expect(normalizeSocialUrl("https://tiktok.com/@kizildagoto")).toBe("https://tiktok.com/@kizildagoto")
  })

  test("boş girdi için null döner", () => {
    expect(normalizeSocialUrl("")).toBeNull()
    expect(normalizeSocialUrl("   ")).toBeNull()
    expect(normalizeSocialUrl(null)).toBeNull()
    expect(normalizeSocialUrl(undefined)).toBeNull()
  })

  test("http/https dışındaki şemaları reddeder — değer href içine basılıyor", () => {
    expect(normalizeSocialUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeSocialUrl("javascript://instagram.com/%0aalert(1)")).toBeNull()
    expect(normalizeSocialUrl("data:text/html,<script>alert(1)</script>")).toBeNull()
  })

  test("alan adı gibi görünmeyen girdiyi reddeder", () => {
    expect(normalizeSocialUrl("kizildagoto")).toBeNull()
    expect(normalizeSocialUrl("localhost/kizildagoto")).toBeNull()
    expect(normalizeSocialUrl("https://")).toBeNull()
  })
})

describe("normalizeContactNumber", () => {
  test("yazım biçiminden bağımsız 10 haneye indirger", () => {
    expect(normalizeContactNumber("0544 515 74 08")).toBe("5445157408")
    expect(normalizeContactNumber("+90 544 515 74 08")).toBe("5445157408")
    expect(normalizeContactNumber("(0212) 111 22 33")).toBe("2121112233")
  })

  test("yarım veya fazla haneli numarayı reddeder", () => {
    expect(normalizeContactNumber("0544 515")).toBeNull()
    expect(normalizeContactNumber("123")).toBeNull()
    expect(normalizeContactNumber("")).toBeNull()
    expect(normalizeContactNumber(null)).toBeNull()
  })
})

describe("buildWorkshopContactEntries", () => {
  test("dolu alanları etiket, gösterim değeri ve bağlantısıyla döner", () => {
    const { channels, socials } = buildWorkshopContactEntries({
      publicWhatsappNumber: "5445157408",
      secondaryPhone: "2121112233",
      faxNumber: "2121112244",
      instagramUrl: "https://instagram.com/kizildagoto",
    })

    expect(channels.map((c) => [c.label, c.value, c.href])).toEqual([
      ["WhatsApp", "0544 515 74 08", "https://wa.me/905445157408"],
      ["Telefon 2", "0212 111 22 33", "tel:+902121112233"],
      ["Faks", "0212 111 22 44", null],
    ])
    expect(socials).toEqual([
      {
        key: "instagramUrl",
        label: "Instagram",
        value: "instagram.com/kizildagoto",
        href: "https://instagram.com/kizildagoto",
        icon: "instagram",
      },
    ])
  })

  test("sosyal medya sırası sabittir", () => {
    const { socials } = buildWorkshopContactEntries({
      linkedinUrl: "linkedin.com/company/a",
      instagramUrl: "instagram.com/a",
      youtubeUrl: "youtube.com/@a",
      facebookUrl: "facebook.com/a",
    })
    expect(socials.map((s) => s.label)).toEqual(["Instagram", "Facebook", "YouTube", "LinkedIn"])
  })

  test("her sosyal satır bir marka ikonu taşır, numara satırları taşımaz", () => {
    const { channels, socials } = buildWorkshopContactEntries({
      publicWhatsappNumber: "5445157408",
      faxNumber: "2121112244",
      instagramUrl: "instagram.com/a",
      facebookUrl: "facebook.com/a",
      xUrl: "x.com/a",
      tiktokUrl: "tiktok.com/@a",
      youtubeUrl: "youtube.com/@a",
      linkedinUrl: "linkedin.com/company/a",
    })

    expect(socials.map((s) => s.icon)).toEqual(["instagram", "facebook", "x", "tiktok", "youtube", "linkedin"])
    // Telefon/faks bir marka değil — jenerik ikonla gösterilir.
    expect(channels.every((c) => c.icon === undefined)).toBe(true)
  })

  test("boş, yarım ve geçersiz alanlar hiç satır açmaz", () => {
    const { channels, socials } = buildWorkshopContactEntries({
      publicWhatsappNumber: "",
      secondaryPhone: "0544 515",
      faxNumber: null,
      instagramUrl: "   ",
      facebookUrl: "javascript:alert(1)",
      xUrl: undefined,
    })
    expect(channels).toEqual([])
    expect(socials).toEqual([])
  })

  test("hiç alan yoksa / kayıt yoksa bölüm gizlenir", () => {
    expect(hasWorkshopContactInfo(null)).toBe(false)
    expect(hasWorkshopContactInfo(undefined)).toBe(false)
    expect(hasWorkshopContactInfo({})).toBe(false)
    expect(hasWorkshopContactInfo({ faxNumber: "2121112244" })).toBe(true)
  })
})

describe("pickWorkshopPublicContact", () => {
  test("yalnızca müşteriye açık alanları taşır — ayarların gerisi sızmaz", () => {
    const settings = {
      instagramUrl: "https://instagram.com/a",
      publicWhatsappNumber: "5445157408",
      whatsappApiKey: "gizli-anahtar",
      whatsappPhoneNumber: "5550000000",
    } as Record<string, string>

    const picked = pickWorkshopPublicContact(settings)
    expect(Object.keys(picked ?? {}).sort()).toEqual(
      [
        "facebookUrl",
        "faxNumber",
        "instagramUrl",
        "linkedinUrl",
        "publicWhatsappNumber",
        "secondaryPhone",
        "tiktokUrl",
        "xUrl",
        "youtubeUrl",
      ].sort()
    )
    expect(JSON.stringify(picked)).not.toContain("gizli-anahtar")
    expect(JSON.stringify(picked)).not.toContain("5550000000")
  })

  test("kayıt yoksa null döner", () => {
    expect(pickWorkshopPublicContact(null)).toBeNull()
  })
})
