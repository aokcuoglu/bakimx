import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * #183 — yetki kapısı KAPSAM testi.
 *
 * `requireWritableWorkshop(permission)` imzası zorunlu olduğu için var olan çağrı
 * yerleri derleyici tarafından korunuyor. Korunmayan tek şey, kapıyı HİÇ
 * çağırmayan yeni bir action: `requireAuth()` ile yazan bir fonksiyon sessizce
 * hem rol kapısını hem plan yazma kilidini atlar. Bu testin yakaladığı budur.
 *
 * Yeni bir muafiyet gerekiyorsa ALLOWLIST'e gerekçesiyle eklenir — bilinçli bir
 * karar olsun, fark edilmeden geçmesin.
 */

const APP_DIR = join(import.meta.dir, "..", "app")

/** Kapıdan bilerek muaf mutasyonlar. Anahtar: "dosya::fonksiyon". */
const ALLOWLIST = new Map<string, string>([
  [
    "(app)/billing/actions.ts::createBillingOrder",
    "Satın alma planı bitmiş atölyenin işi; plan yazma kilidi uygulanamaz. Rol kapısı roleCan ile elde yapılır.",
  ],
  [
    "(app)/intakes/delivery-actions.ts::requestDeliveryOtpAction",
    "Teslim akışı plan kilidi altında da tamamlanmalı. Rol kapısı assertCan ile elde yapılır.",
  ],
  [
    "(app)/intakes/delivery-actions.ts::verifyDeliveryOtpAction",
    "Teslim akışı plan kilidi altında da tamamlanmalı. Rol kapısı assertCan ile elde yapılır.",
  ],
  [
    "(app)/settings/actions.ts::getWorkshopSettings",
    "Okuma yolu; ayar satırı yoksa varsayılanı bir kez oluşturur. Yetki gerektirmez.",
  ],
  [
    "invite/[token]/actions.ts::acceptInviteAction",
    "Daveti kabul eden kullanıcı henüz atölye üyesi değildir; rol kapısı uygulanamaz.",
  ],
  [
    "invite/sales/[token]/actions.ts::acceptSalesAdvisorInvite",
    "Satış danışmanı davetini kabul eden kişi henüz kullanıcı değildir; tek kullanımlık token ve transaction kapısı kimliği kurar.",
  ],
  [
    "(app)/account/actions.ts::changeOwnPasswordAction",
    "Kendi şifresini değiştirme kimlik işlemidir, izin gerektirmez. Kapı geçici şifreli kullanıcıyı reddettiği için (assertPasswordChanged) buradan geçseydi kilit hiç açılamazdı; mevcut şifre bcrypt ile ayrıca doğrulanır.",
  ],
  [
    "(app)/account/actions.ts::updateOwnProfileAction",
    "Kendi ad-soyadını güncelleme kişisel kimlik işlemidir; her rol yapabilmeli ve plan kilidi altında da çalışması doğru davranış.",
  ],
])

const MUTATION = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/
const GATE = "requireWritableWorkshop("

function actionFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) actionFiles(full, acc)
    else if (entry.endsWith("actions.ts")) acc.push(full)
  }
  return acc
}

test("yazma yapan her server action yetki kapısından geçer", () => {
  const ungated: string[] = []

  for (const file of actionFiles(APP_DIR)) {
    const rel = file.slice(APP_DIR.length + 1)
    // /admin kendi ayrı yetki modeline sahip (platform yöneticisi, kiracı değil).
    if (rel.startsWith("admin/")) continue
    const source = readFileSync(file, "utf8")

    for (const block of source.split("\nexport async function ").slice(1)) {
      const name = block.split("(")[0]
      if (!MUTATION.test(block)) continue
      if (block.includes(GATE)) continue
      if (ALLOWLIST.has(`${rel}::${name}`)) continue
      ungated.push(`${rel}::${name}`)
    }
  }

  expect(ungated).toEqual([])
})

test("allowlist'teki her muafiyetin gerekçesi yazılı", () => {
  for (const [key, reason] of ALLOWLIST) {
    expect(reason.length).toBeGreaterThan(20)
    expect(key).toContain("::")
  }
})
