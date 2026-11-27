import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"

// Elle yazılmış tonlu bilgi kutusu kapısı (#920): `bg-<ton>/N border-<ton>/N
// rounded-* p-*` taşıyan bir div/p/section "uyarı kutusu"dur ve köşesini
// `--control-radius`'tan alan `<Alert variant="…">` olmalıdır. Elle yazılan
// kutu köşeyi/dolguyu kendi seçer ve iç içe köşe kapısını (#898) dolaşır.
// Taranan: tek bir string literal içinde (ya da template parçasında) HEM
// `bg-<ton>/N` HEM `border-<ton>/N` HEM `rounded-(sm|md|lg|xl)` HEM `p-N/px-N`.
// Rozet (`rounded-full`/`inline-flex`/sabit `h-N`), Badge/Card `className`'i ve
// seçili-durum vurgusu bu birleşimi taşımaz ya da aşağıda gerekçeyle listelenir.
// Sınır: sözcüksel; `cn(...)` içine bölünmüş sınıfları ve başka dosyadaki
// bileşenin sınıflarını görmez.

const SRC = join(import.meta.dir, "..")
const TONE = "(?:success|warning|destructive|primary|info)"
const BG = new RegExp(`(?<![:\\w-])bg-${TONE}/\\d+`)
const BORDER = new RegExp(`(?<![:\\w-])border-${TONE}(?:/\\d+)?(?![\\w-])`)
const ROUNDED = /(?<![:\w-])rounded-(?:sm|md|lg|xl)(?![\w-])/
const PADDING = /(?<![:\w-])p[xy]?-\d/
const BADGE_LIKE = /(?:rounded-full|inline-flex|(?<![:\w-])h-\d)/

// Bilgi kutusu DEĞİL ya da başka dilime ait. Gerekçesiz ekleme yapma.
const SKIP_DIRS: Record<string, string> = {
  "components/ui": "paylaşılan primitive'ler (Alert'in kendisi dahil)",
  "components/sections": "pazarlama/landing — #1000 oturumu",
  "app/(site)": "pazarlama/landing — #1000 oturumu",
  "app/admin": "yönetim dilimi (#920 dilim 4)",
  "components/site-assistant": "herkese açık widget (#920 dilim 5)",
}
const ALLOWLIST: Record<string, string> = {
  "components/parts/getirbakim-product-row.tsx": "satır içi katalog etiketi (chip), uyarı değil",
  "components/intake/public-share-page.tsx": "herkese açık sayfa — #920 dilim 5",
  "components/vehicles/public-vehicle-passport.tsx": "herkese açık sayfa — #920 dilim 5",
  "components/vehicles/ruhsattan-oku.tsx": "etkileşimli ruhsat okuma paneli (kamera/dosya), uyarı değil",
  "components/technician/technician-order-detail.tsx": "not satırı (liste öğesi), uyarı değil",
  "components/technician/work-screen/work-details.tsx": "iç not satırı (silme düğmeli liste öğesi), uyarı değil",
  "components/technician/purchase-form-sheet.tsx": "bağlı kalem özeti ve OCR öneri paneli (etkileşimli), uyarı değil",
  "components/billing/purchase-wizard.tsx": "seçili paket kartı (seçili-durum vurgusu), uyarı değil",
}

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) files(p, out)
    else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) out.push(p)
  }
  return out
}

function literals(path: string): { text: string; line: number }[] {
  const src = readFileSync(path, "utf8")
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: { text: string; line: number }[] = []
  const visit = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      found.push({ text: n.text, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return found
}

function isHandBuiltTintedBox(text: string): boolean {
  return BG.test(text) && BORDER.test(text) && ROUNDED.test(text) && PADDING.test(text) && !BADGE_LIKE.test(text)
}

test("isHandBuiltTintedBox: kutuyu yakalar, rozet/seçili-durumu yakalamaz", () => {
  expect(isHandBuiltTintedBox("rounded-lg border border-warning/20 bg-warning/10 p-3")).toBe(true)
  expect(isHandBuiltTintedBox("p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm")).toBe(true)
  expect(isHandBuiltTintedBox("inline-flex h-5 px-2 rounded-full border bg-success/10 border-success/20")).toBe(false)
  expect(isHandBuiltTintedBox("bg-primary/10 text-primary-strong border-primary/20")).toBe(false)
  expect(isHandBuiltTintedBox("rounded-md border border-border bg-card p-3")).toBe(false)
})

test("elle yazılmış tonlu bilgi kutusu yok: <Alert variant> kullan (#920)", () => {
  const offenders: string[] = []
  for (const f of files(SRC)) {
    const rel = relative(SRC, f)
    if (Object.keys(SKIP_DIRS).some((d) => rel.startsWith(d))) continue
    if (rel in ALLOWLIST) continue
    for (const { text, line } of literals(f)) {
      if (isHandBuiltTintedBox(text)) offenders.push(`${rel}:${line}`)
    }
  }
  expect(offenders).toEqual([])
})
