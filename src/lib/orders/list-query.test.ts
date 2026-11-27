import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { ORDER_LIST_DATA_COLUMN_ORDER } from "./list-columns"
import {
  buildOrderListOrderBy,
  buildOrderListWhere,
  buildOrderSearchWhere,
  nextOrderListLimit,
  ORDER_LIST_SELECT,
  resolveOrderListLimit,
  resolveOrderListSort,
  toOrderListRow,
} from "./list-query"

describe("resolveOrderListLimit", () => {
  test("geçersiz ya da küçük değer ilk sayfaya düşer", () => {
    for (const raw of [undefined, "abc", "0", "-5", "12.5"]) expect(resolveOrderListLimit(raw)).toBe(100)
  })
  test("sayfa boyutu katına yuvarlanır ve tavana kırpılır", () => {
    expect(resolveOrderListLimit("150")).toBe(200)
    expect(resolveOrderListLimit("300")).toBe(300)
    expect(resolveOrderListLimit("99999")).toBe(500)
  })
})

describe("nextOrderListLimit", () => {
  test("yüklenecek kayıt yoksa ya da tavandaysa null", () => {
    expect(nextOrderListLimit(100, 80)).toBeNull()
    expect(nextOrderListLimit(100, 100)).toBeNull()
    expect(nextOrderListLimit(500, 9000)).toBeNull()
  })
  test("bir sayfa büyür", () => {
    expect(nextOrderListLimit(100, 250)).toBe(200)
    expect(nextOrderListLimit(400, 9000)).toBe(500)
  })
})

describe("buildOrderSearchWhere", () => {
  test("boş arama filtre üretmez", () => {
    expect(buildOrderSearchWhere("")).toEqual({})
  })
  test("plaka normalleştirilmiş biçimle de aranır", () => {
    expect(JSON.stringify(buildOrderSearchWhere("34 myl 739"))).toContain('"plate":{"contains":"34MYL739"}')
  })
  test("müşteri tam adı ve firma adı aranır", () => {
    const json = JSON.stringify(buildOrderSearchWhere("ali"))
    expect(json).toContain('"fullName":{"contains":"ali"')
    expect(json).toContain('"companyName":{"contains":"ali"')
  })
})

describe("buildOrderListWhere", () => {
  test("workshopId üstte, parçalar AND içinde ezilmeden", () => {
    const where = buildOrderListWhere("w1", [{ status: "approved" }, { status: { in: ["draft"] } }])
    expect(where.workshopId).toBe("w1")
    expect(where.AND).toEqual([{ status: "approved" }, { status: { in: ["draft"] } }])
  })
})

describe("ORDER_LIST_SELECT", () => {
  test("kalem alanları ortak sabitten gelir, tam müşteri ilişkisi çekilmez", () => {
    expect(ORDER_LIST_SELECT.items.select).toBe(ORDER_TOTALS_ITEM_SELECT)
    expect("customer" in ORDER_LIST_SELECT.intakeForm.select).toBe(false)
  })
})

function order(over: Partial<Parameters<typeof toOrderListRow>[0]> = {}): Parameters<typeof toOrderListRow>[0] {
  return {
    id: "abcdef123456",
    workOrderNo: null,
    status: "approved",
    paymentStatus: "unpaid",
    assignedTechnicianId: null,
    estimatedDeliveryAt: null,
    createdAt: new Date("2026-01-02T00:00:00Z"),
    discountAmount: 0,
    taxRate: 2000,
    invoiceNo: null,
    items: [],
    assignedTechnician: null,
    intakeForm: {
      vehicle: {
        id: "v1",
        plate: "34ABC123",
        brand: "Fiat",
        model: "Egea",
        customer: {
          id: "c-current",
          firstName: "Ali",
          lastName: "Veli",
          fullName: "Ali Veli",
          companyName: null,
          type: "individual",
          phone: "555",
        },
      },
    },
    ...over,
  } as Parameters<typeof toOrderListRow>[0]
}

describe("toOrderListRow", () => {
  test("müşteri aracın güncel sahibinden gelir", () => {
    const row = toOrderListRow(order())
    expect(row.customer.id).toBe("c-current")
    expect(row.vehicle.plate).toBe("34ABC123")
    expect(row.workOrderNo).toBe("BX-123456")
  })
  test("kalemsiz sipariş fiyatsızdır", () => {
    expect(toOrderListRow(order()).hasPrice).toBe(false)
  })
  test("KDV'siz kalemde KDV eklenmez", () => {
    const item = { totalPrice: 10000, unitPrice: 10000, quantity: 1, type: "part", includeVat: false }
    const exempt = toOrderListRow(order({ items: [item] as never }))
    const taxable = toOrderListRow(order({ items: [{ ...item, includeVat: true }] as never }))
    expect(exempt.grandTotal).toBe(10000)
    expect(taxable.grandTotal).toBe(12000)
  })
  test("teslime hazır ve fatura no yoksa invoiceMissing", () => {
    expect(toOrderListRow(order({ status: "ready_for_delivery" })).invoiceMissing).toBe(true)
    expect(toOrderListRow(order({ status: "ready_for_delivery", invoiceNo: "F-1" })).invoiceMissing).toBe(false)
  })
})

test("sayfa sorgusu sınırlıdır ve tam satır/include çekmez", () => {
  const page = readFileSync(join(import.meta.dir, "../../app/(app)/orders/page.tsx"), "utf8")
  expect(page).toContain("take:")
  expect(page).not.toContain("items: true")
  expect(page).not.toContain("include:")
})

describe("resolveOrderListSort", () => {
  test("geçerli kolon ve yön çözülür; yön yoksa artan", () => {
    expect(resolveOrderListSort("total", "desc")).toEqual({ column: "total", desc: true })
    expect(resolveOrderListSort("customer", undefined)).toEqual({ column: "customer", desc: false })
    expect(resolveOrderListSort("customer", "bogus")).toEqual({ column: "customer", desc: false })
  })
  test("bilinmeyen kolon (ör. actions, ham alan adı) varsayılan sıraya düşer", () => {
    for (const raw of [undefined, "", "actions", "grandTotal", "id; drop table", "__proto__"]) {
      expect(resolveOrderListSort(raw, "desc")).toBeNull()
    }
  })
})

describe("buildOrderListOrderBy", () => {
  test("sıralama yoksa en yeni önce (createdAt, id)", () => {
    expect(buildOrderListOrderBy(null)).toEqual([{ createdAt: "desc" }, { id: "desc" }])
  })

  test("her kolon kararlı bağlayıcıyla biter: createdAt desc sonra id desc", () => {
    for (const column of ORDER_LIST_DATA_COLUMN_ORDER) {
      for (const desc of [false, true]) {
        const orderBy = buildOrderListOrderBy({ column, desc })
        expect(orderBy).toHaveLength(3)
        expect(orderBy.slice(1)).toEqual([{ createdAt: "desc" }, { id: "desc" }])
      }
    }
  })

  test("kolon → birincil anahtar eşlemesi", () => {
    const primary = (column: (typeof ORDER_LIST_DATA_COLUMN_ORDER)[number], desc: boolean) => buildOrderListOrderBy({ column, desc })[0]
    expect(primary("total", true)).toEqual({ grandTotal: { sort: "desc", nulls: "last" } })
    expect(primary("total", false)).toEqual({ grandTotal: { sort: "asc", nulls: "last" } })
    expect(primary("dates", true)).toEqual({ createdAt: "desc" })
    expect(primary("delivery", false)).toEqual({ estimatedDeliveryAt: { sort: "asc", nulls: "last" } })
    expect(primary("status", false)).toEqual({ status: "asc" })
    expect(primary("payment", true)).toEqual({ paymentStatus: "desc" })
    expect(primary("invoice", false)).toEqual({ invoiceNo: { sort: "asc", nulls: "last" } })
    expect(primary("workOrderNo", false)).toEqual({ workOrderNo: { sort: "asc", nulls: "last" } })
    expect(primary("vehicle", false)).toEqual({ intakeForm: { vehicle: { plate: "asc" } } })
    expect(primary("customer", true)).toEqual({ intakeForm: { vehicle: { customer: { fullName: { sort: "desc", nulls: "last" } } } } })
    expect(primary("technician", false)).toEqual({ assignedTechnician: { fullName: "asc" } })
  })
})
