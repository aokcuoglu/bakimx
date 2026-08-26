import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * BAK-93 — platform yetki kapısı KAPSAM testi.
 *
 * `src/lib/rbac-coverage.test.ts` `/admin` altını bilerek atlar (orası kiracı
 * değil platform yetki modelidir), yani konsolun mutasyonlarını hiçbir test
 * korumuyordu. Roller tek değerliyken (`founder`) bunun bedeli yoktu; artık
 * `readonly` bir yönetici var ve kapısız bir action ona her şeyi açar.
 *
 * Yakalanan şey: `/admin` altında yazma yapan ama `requireAdminCapability()`
 * ÇAĞIRMAYAN bir server action. `requireAdmin()` yalnız "konsola girebilir mi"
 * sorusuna bakar — yetki sorusuna değil.
 */

const ADMIN_DIR = join(import.meta.dir, "..", "app", "admin")

/** Kapıdan bilerek muaf mutasyonlar. Anahtar: "dosya::fonksiyon". */
const ALLOWLIST = new Map<string, string>([
  [
    "sales/actions.ts::createSalesLead",
    "Satış yüzeyi PlatformAdmin yetkisini değil getSalesAccess() ile danışman profili ya da yönetici kimliğini doğrular; tenant-admin yetenek kapısı burada yanlış güvenlik modelidir.",
  ],
  [
    "sales/actions.ts::setSalesLeadStatus",
    "Satış yüzeyi PlatformAdmin yetkisini değil getSalesAccess() ile danışman profili ya da yönetici kimliğini doğrular; tenant-admin yetenek kapısı burada yanlış güvenlik modelidir.",
  ],
  [
    "sales/actions.ts::addSalesActivity",
    "Satış yüzeyi PlatformAdmin yetkisini değil getSalesAccess() ile danışman profili ya da yönetici kimliğini doğrular; tenant-admin yetenek kapısı burada yanlış güvenlik modelidir.",
  ],
  [
    "sales/actions.ts::updateSalesCommission",
    "Hakediş action'ı getSalesAccess() ardından yalnız kind=admin kabul eder; danışmanların tutar veya ödeme durumuna erişimi yoktur.",
  ],
  [
    "sales/actions.ts::convertSalesLead",
    "İş yeri açma action'ı getSalesAccess() ardından yalnız kind=admin kabul eder; danışman üretim tenant'ı oluşturamaz.",
  ],
  ["sales/actions.ts::setSalesReferralStatus", "Satış referansı getSalesAccess() ve danışman sahiplik kontrolüyle korunur."],
  ["sales/actions.ts::generateSalesDiscountCode", "İndirim kodu getSalesAccess() ve bağlı aday sahiplik kontrolüyle korunur."],
  ["sales/actions.ts::updateSalesDiscountCode", "İndirim kodu güncellemesi satış erişimi ve sahiplik kontrolüyle korunur."],
  ["sales/actions.ts::deactivateSalesDiscountCode", "İndirim kodu pasifleştirmesi satış erişimi ve sahiplik kontrolüyle korunur."],
  [
    "impersonation-actions.ts::stopImpersonation",
    "Kendi impersonation oturumunu KAPATMA işlemi. Yetki kapısına bağlansaydı, yetkisi geri alınmış bir yönetici açık oturumdan çıkamaz hâle gelirdi; işlem yalnız çerezdeki kendi oturumunu sonlandırır.",
  ],
])

const MUTATION = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/
const GATE = "requireAdminCapability("

function actionFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) actionFiles(full, acc)
    else if (entry.endsWith("actions.ts")) acc.push(full)
  }
  return acc
}

test("/admin altında yazma yapan her server action yetenek kapısından geçer", () => {
  const ungated: string[] = []

  for (const file of actionFiles(ADMIN_DIR)) {
    const rel = file.slice(ADMIN_DIR.length + 1)
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
    expect(reason.length, `${key} için gerekçe çok kısa`).toBeGreaterThan(30)
  }
})
