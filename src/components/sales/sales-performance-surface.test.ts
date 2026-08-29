import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const dashboard = readFileSync(join(import.meta.dir, "sales-performance-dashboard.tsx"), "utf8")
const today = readFileSync(join(import.meta.dir, "../../app/admin/sales/sales-console.tsx"), "utf8")

test("performans yüzeyi hedef, huni, trend, ledger ve karşılaştırma bölümlerini birlikte sunar", () => {
  for (const label of [
    "Hedef gerçekleşme",
    "Mevcut satış hunisi",
    "Dönem trendi",
    "Danışman karşılaştırması",
    "Aylık hedef tanımlama",
    "Hesaplanan hakediş",
    "Ödenen hakediş",
  ]) expect(dashboard).toContain(label)
})

test("danışman karşılaştırması mobil kart ve masaüstü tablo düzenine ayrılır", () => {
  expect(dashboard).toContain('className="space-y-3 md:hidden"')
  expect(dashboard).toContain('containerClassName="hidden md:block"')
})

test("Bugünüm yüzeyi danışmana aylık hedef ilerlemesi ve ayrıntı çıkışı verir", () => {
  expect(today).toContain("Aylık hedef ilerlemeniz")
  expect(today).toContain('href="/admin/sales/performance"')
  expect(today).toContain("monthlyPerformance &&")
})
