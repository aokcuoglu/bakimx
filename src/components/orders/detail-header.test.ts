import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (f: string) => readFileSync(join(import.meta.dir, f), "utf8")
const HEADER = read("detail-header.tsx")
const DETAIL = read("work-order-detail.tsx")

test("başlık breadcrumb + plaka rozeti + taşma menüsü taşır", () => {
  expect(HEADER).toContain('aria-label="Sayfa yolu"')
  expect(HEADER).toContain("<Link href={backHref}")
  expect(HEADER).toContain('aria-current="page"')
  expect(HEADER).toContain("detectPlate(plate)")
  expect(HEADER).toContain("<Plate ")
  expect(HEADER).toContain("splitHeaderActions(")
  expect(HEADER).toContain("DropdownMenuTrigger asChild")
  expect(HEADER).toContain('size="icon"')
  expect(HEADER).not.toContain("size-8")
})

test("detay sayfası başlığa dönüş adresi, durum ve ödeme hapını geçirir", () => {
  expect(DETAIL).toContain("backHref={orderListReturnHref(returnTo)}")
  expect(DETAIL).toContain("<DashOrderStatus status={order.status} />")
  expect(DETAIL).toContain("canCashbox && <OrderPaymentPill")
})

test("BÜYÜK HARF etiket kalıbı geri dönmez", () => {
  for (const f of ["work-order-detail.tsx", "order-info-card.tsx", "order-record-rail.tsx"]) {
    expect(read(f)).not.toContain("uppercase tracking-wider")
  }
})
