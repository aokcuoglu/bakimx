import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  SMS_PROVIDER_LABELS,
  WHATSAPP_PROVIDER_LABELS,
  EMAIL_PROVIDER_LABELS,
  NOTIFICATION_PROVIDER_LABELS,
  SENDING_DISABLED_LABEL,
  CALENDAR_DISABLED_LABEL,
  ADVISOR_DEMO_NOTICE,
  advisorProviderNotice,
} from "./provider-labels"

/**
 * Atölye kullanıcısı ayar ekranlarında "Mock (Test)" görüyordu (#195) — kendisine
 * hiçbir şey ifade etmeyen bir geliştirici terimi. Etiketler tek kaynağa taşındı;
 * bu test hem etiketlerin teknik ada geri dönmediğini hem de ayar bileşenlerine
 * yeni bir "Mock" metninin sızmadığını kontrol eder.
 *
 * Küçük harfli `mock` serbest: env değeri (`CALENDAR_PROVIDER=mock`), sağlayıcı
 * anahtarı ve karşılaştırmalar öyle yazılıyor. Yasak olan, kullanıcıya metin
 * olarak basılan büyük harfli "Mock".
 */

const SETTINGS_DIRS = [
  join(import.meta.dir, "..", "components", "settings"),
  join(import.meta.dir, "..", "app", "(app)", "settings"),
  // Danışman paneli de aynı kurala tabi (#253).
  join(import.meta.dir, "..", "components", "advisor"),
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(entry) && !entry.includes(".test.")) out.push(full)
  }
  return out
}

test("sağlayıcı etiketleri kullanıcıya teknik ad göstermez", () => {
  const maps = [
    SMS_PROVIDER_LABELS,
    WHATSAPP_PROVIDER_LABELS,
    EMAIL_PROVIDER_LABELS,
    NOTIFICATION_PROVIDER_LABELS,
  ]
  for (const map of maps) {
    for (const [key, label] of Object.entries(map)) {
      expect(label.toLowerCase()).not.toContain("mock")
      expect(label.trim().length).toBeGreaterThan(0)
      expect(key.trim().length).toBeGreaterThan(0)
    }
  }
})

test("mock sağlayıcı, gönderimin kapalı olduğunu söyleyen etiketi kullanır", () => {
  expect(SMS_PROVIDER_LABELS.mock).toBe(SENDING_DISABLED_LABEL)
  expect(WHATSAPP_PROVIDER_LABELS.mock).toBe(SENDING_DISABLED_LABEL)
  expect(EMAIL_PROVIDER_LABELS.mock).toBe(SENDING_DISABLED_LABEL)
  expect(NOTIFICATION_PROVIDER_LABELS.mock).toBe(SENDING_DISABLED_LABEL)
  expect(SENDING_DISABLED_LABEL).toContain("Kapalı")
  // Takvimde "gönderim" yok; etiket senkronizasyon dilinde olmalı.
  expect(CALENDAR_DISABLED_LABEL).toContain("Kapalı")
  expect(CALENDAR_DISABLED_LABEL).not.toContain("gönderim")
})

test("gerçek sağlayıcı adları korunur", () => {
  expect(SMS_PROVIDER_LABELS.netgsm).toBe("Netgsm")
  expect(WHATSAPP_PROVIDER_LABELS.business_api).toBe("WhatsApp Business API")
  expect(EMAIL_PROVIDER_LABELS.resend).toBe("Resend")
  // Bildirimler ekranı env'den `business` de alabiliyor.
  expect(NOTIFICATION_PROVIDER_LABELS.business).toBe("WhatsApp Business API")
  expect(NOTIFICATION_PROVIDER_LABELS.gmail).toBe("Gmail")
})

test("danışman notu: mock'ta demo uyarısı, gerçek sağlayıcıda ad (#253)", () => {
  expect(advisorProviderNotice("mock")).toBe(ADVISOR_DEMO_NOTICE)
  expect(ADVISOR_DEMO_NOTICE.toLowerCase()).not.toContain("mock")
  // Panel yine çıktı ürettiği için "kapalı" demiyoruz.
  expect(ADVISOR_DEMO_NOTICE.toLowerCase()).not.toContain("kapalı")

  expect(advisorProviderNotice("anthropic")).toBe("Sağlayıcı: Claude")
  expect(advisorProviderNotice("openai")).toBe("Sağlayıcı: OpenAI")

  // Sonuç yokken ya da tanınmayan değerde hiçbir şey gösterilmez.
  expect(advisorProviderNotice(undefined)).toBe("")
  expect(advisorProviderNotice(null)).toBe("")
  expect(advisorProviderNotice("")).toBe("")
  expect(advisorProviderNotice("deepseek")).toBe("")
})

test("ayar ve danışman ekranlarında kullanıcıya görünen 'Mock' metni kalmadı", () => {
  const offenders: string[] = []
  for (const dir of SETTINGS_DIRS) {
    for (const file of walk(dir)) {
      const source = readFileSync(file, "utf8")
      source.split("\n").forEach((line, i) => {
        if (line.includes("Mock")) offenders.push(`${file}:${i + 1}: ${line.trim()}`)
      })
    }
  }
  expect(offenders).toEqual([])
})
