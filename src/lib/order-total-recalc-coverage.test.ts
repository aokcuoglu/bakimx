import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * #831 — saklanan toplam (`ServiceOrder.grandTotal`) KAPSAM testi.
 *
 * Liste "Toplam" sıralaması bu kolona dayanır; kolon yalnız `recalcOrderPayment`
 * ile yenilenir. Kalem yazan ya da indirim/KDV'yi değiştiren bir dosya o
 * fonksiyonu çağırmazsa toplam sessizce bayatlar ve sıralama yanlış çıkar.
 * Bu test kaynağı tarar (rbac-coverage ile aynı stil).
 *
 * Muafiyet gerekiyorsa ALLOWLIST'e GEREKÇESİYLE ekle; taramayı daraltma.
 */

const ROOT = join(import.meta.dir, "..", "..")
const SCAN_DIRS = ["src", "scripts"]

/** Dosya yolu (repo köküne göre) → toplamı etkilemeyen yazımın gerekçesi. */
const ALLOWLIST = new Map<string, string>([
  [
    "src/app/(app)/technician/actions.ts",
    "Kalem yazımları yalnız completedAt/completedById (tamamlandı işareti) değiştirir — tutar/adet/KDV alanlarına dokunmaz. Parça talebini kaleme çeviren yol ise recalcOrderPayment çağırır.",
  ],
  [
    "scripts/backfill-order-grand-total.ts",
    "Kolonu doğrudan hesaplayıp yazan backfill betiği; recalc yerine aynı computeStoredGrandTotal'ı kullanır.",
  ],
])

const ITEM_WRITE = /serviceOrderItem\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/
const ORDER_WRITE = /serviceOrder\.(create|update|updateMany|upsert)\(/
const TOTAL_FIELDS = /\b(discountAmount|taxRate)\b/
const RECALC_CALL = /recalcOrderPayment\(/

/** Dosyanın toplamı etkileyen yazımı var mı, ve recalc çağırıyor mu. */
export function analyzeSource(source: string): { writesTotals: boolean; callsRecalc: boolean } {
  const writesTotals = ITEM_WRITE.test(source) || (ORDER_WRITE.test(source) && TOTAL_FIELDS.test(source))
  return { writesTotals, callsRecalc: RECALC_CALL.test(source) }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|e2e)\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

describe("saklanan toplam kapsamı", () => {
  test("kalem/indirim/KDV yazan her dosya recalcOrderPayment çağırır", () => {
    const violations: string[] = []
    for (const dir of SCAN_DIRS) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = relative(ROOT, file)
        if (rel === "src/lib/cashbox/recalc.ts" || ALLOWLIST.has(rel)) continue
        const { writesTotals, callsRecalc } = analyzeSource(readFileSync(file, "utf8"))
        if (writesTotals && !callsRecalc) violations.push(rel)
      }
    }
    expect(violations).toEqual([])
  })

  test("muafiyet listesi bayat girdi taşımaz", () => {
    for (const rel of ALLOWLIST.keys()) {
      const { writesTotals } = analyzeSource(readFileSync(join(ROOT, rel), "utf8"))
      expect(writesTotals).toBe(true)
    }
  })

  test("pozitif: kalem yazıp recalc çağıran kaynak geçer", () => {
    const src = "await tx.serviceOrderItem.create({ data })\nawait recalcOrderPayment(tx, id, ws)"
    expect(analyzeSource(src)).toEqual({ writesTotals: true, callsRecalc: true })
  })

  test("negatif: recalc'sız kalem yazımı ve indirim güncellemesi yakalanır", () => {
    expect(analyzeSource("await tx.serviceOrderItem.deleteMany({ where })")).toEqual({ writesTotals: true, callsRecalc: false })
    expect(analyzeSource("await prisma.serviceOrder.updateMany({ data: { discountAmount: 5 } })")).toEqual({ writesTotals: true, callsRecalc: false })
  })

  test("durum güncellemesi toplamı etkilemez (yanlış alarm yok)", () => {
    expect(analyzeSource('await prisma.serviceOrder.updateMany({ data: { status: "delivered" } })').writesTotals).toBe(false)
  })
})
