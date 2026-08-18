import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  buildWorkshopListHref,
  buildWorkshopWhere,
  isWorkshopListFiltered,
  parseWorkshopListParams,
} from "@/lib/admin-workshop-filters"

test("tanınmayan durum değerleri sorguya sızmaz", () => {
  const query = parseWorkshopListParams({
    approval: "'; drop table workshops; --",
    subscription: "aktif",
  })

  expect(query.approval).toBeNull()
  expect(query.subscription).toBeNull()
  expect(buildWorkshopWhere(query)).toEqual({})
})

test("geçerli durum değerleri where'e girer", () => {
  const where = buildWorkshopWhere(
    parseWorkshopListParams({ approval: "pending", subscription: "trialing" })
  )

  expect(where.approvalStatus).toBe("pending")
  expect(where.subscriptionStatus).toBe("trialing")
  expect(where.OR).toBeUndefined()
})

test("arama atölye adını ve herhangi bir üyenin e-postasını kapsar", () => {
  const where = buildWorkshopWhere(parseWorkshopListParams({ q: "  Usta Oto  " }))

  expect(where.OR).toEqual([
    { name: { contains: "Usta Oto", mode: "insensitive" } },
    { users: { some: { email: { contains: "Usta Oto", mode: "insensitive" } } } },
  ])
})

test("boş ve aşırı uzun arama metni normalize edilir", () => {
  expect(buildWorkshopWhere(parseWorkshopListParams({ q: "   " })).OR).toBeUndefined()
  expect(parseWorkshopListParams({ q: "a".repeat(500) }).q).toHaveLength(100)
})

test("geçersiz sayfa numarası 1'e düşer", () => {
  expect(parseWorkshopListParams({ page: "0" }).page).toBe(1)
  expect(parseWorkshopListParams({ page: "-3" }).page).toBe(1)
  expect(parseWorkshopListParams({ page: "abc" }).page).toBe(1)
  expect(parseWorkshopListParams({}).page).toBe(1)
  expect(parseWorkshopListParams({ page: "4" }).page).toBe(4)
})

test("bağlantı filtreleri korur, birinci sayfayı yazmaz", () => {
  const query = parseWorkshopListParams({ q: "oto", approval: "pending", page: "3" })

  expect(buildWorkshopListHref(query)).toBe("/admin/workshops?q=oto&approval=pending&page=3")
  expect(buildWorkshopListHref(query, 1)).toBe("/admin/workshops?q=oto&approval=pending")
  expect(buildWorkshopListHref(parseWorkshopListParams({}))).toBe("/admin/workshops")
})

test("filtre var mı doğru raporlanır", () => {
  expect(isWorkshopListFiltered(parseWorkshopListParams({ page: "2" }))).toBe(false)
  expect(isWorkshopListFiltered(parseWorkshopListParams({ q: "oto" }))).toBe(true)
  expect(isWorkshopListFiltered(parseWorkshopListParams({ subscription: "active" }))).toBe(true)
})

/**
 * Liste sıralaması `orderBy: { approvalStatus: "asc" }` ile "onay bekleyen önce"
 * davranışını Postgres enum bildirim sırasından alır. Enum'da `pending` başta
 * olmazsa sıralama sessizce bozulur — ne typecheck ne de lint bunu görür.
 */
test("WorkshopApprovalStatus enum'unda pending ilk sırada", () => {
  const schema = readFileSync(join(import.meta.dir, "..", "..", "prisma", "schema.prisma"), "utf8")
  const block = schema.match(/enum WorkshopApprovalStatus \{([^}]*)\}/)

  expect(block).not.toBeNull()
  const values = (block?.[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  expect(values[0]).toBe("pending")
})
