import { expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * Kaynak tarayan kapı (BAK-53) — bkz. docs/agent-workflows/repo-guardrails.md §5.
 *
 * Toplam hesaplayan bir Prisma sorgusu kalem `select`'ini ELLE yazarsa
 * `includeVat` unutulur; Prisma alanı hiç döndürmez, `isVatLiable` `undefined`
 * görüp satırı KDV'ye TABİ sayar ve muaf kalemden de KDV alınır.
 *
 * Bu sessiz bir hatadır: iş emri ekranı kalemleri tam nesneyle okuduğu için
 * DOĞRU toplamı gösterir, kasa/rapor/tahsilat yüzeyleri dar `select` yüzünden
 * YANLIŞ gösterir. İki yüzey birbirini tutmaz ve kimse fark etmez —
 * BAK-53'ün ilk teslimatında (PR #360) tam olarak bu oldu.
 *
 * Kural: kalem `select`'i elle sıralama, `ORDER_TOTALS_ITEM_SELECT` kullan.
 */

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

const SRC = join(import.meta.dir, "..")

test("kalem select'i elle yazılmaz — ORDER_TOTALS_ITEM_SELECT kullanılır", () => {
  // `totalPrice` + `unitPrice`'ı birlikte seçen her sorgu bir toplam sorgusudur.
  const handRolled = /select:\s*\{[^}]*\btotalPrice:\s*true[^}]*\bunitPrice:\s*true[^}]*\}/
  const offenders: string[] = []

  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, "utf8")
    if (handRolled.test(text)) offenders.push(file.slice(SRC.length + 1))
  }

  expect(offenders).toEqual([])
})

test("sabit includeVat'ı taşır — düşerse muaf kalemden KDV alınır", async () => {
  const { ORDER_TOTALS_ITEM_SELECT } = await import("@/lib/totals")
  expect(ORDER_TOTALS_ITEM_SELECT.includeVat).toBe(true)
  expect(ORDER_TOTALS_ITEM_SELECT.totalPrice).toBe(true)
  expect(ORDER_TOTALS_ITEM_SELECT.unitPrice).toBe(true)
  expect(ORDER_TOTALS_ITEM_SELECT.quantity).toBe(true)
})

test("düzenleyiciye giden DTO includeVat'ı taşır — yoksa kutu refresh'te geri döner", () => {
  // Sunucu değeri yazar ama sayfa DTO'su alanı taşımazsa istemci eski değeri
  // görür ve tick geri gelir; kullanıcı "kaldıramıyorum" der (BAK-53).
  const page = readFileSync(join(SRC, "app/(app)/orders/[id]/page.tsx"), "utf8")
  expect(page).toContain("includeVat: i.includeVat")
})
