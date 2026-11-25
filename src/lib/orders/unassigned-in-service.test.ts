import { describe, expect, test } from "bun:test"
import { resolveOrderStatusFilter } from "@/lib/orders/status-filter"
import { resolveTechnicianFilter } from "@/lib/orders/technician-filter"
import { UNASSIGNED_IN_SERVICE_HREF, UNASSIGNED_IN_SERVICE_WHERE, isUnassignedListHref } from "@/lib/orders/unassigned-in-service"

describe("Genel Bakış 'usta bekliyor' uyarısı (#833)", () => {
  // Liste sayfası (`orders/page.tsx`) URL'i bu iki çözücüyle `where`e çevirip
  // VE ile birleştirir. Kartın sayımı aynı kümeyi saymalı.
  test("bağlantının açtığı liste ile kartın sayımı aynı koşulu kullanır", () => {
    const params = new URL(UNASSIGNED_IN_SERVICE_HREF, "http://localhost").searchParams
    const listWhere = {
      ...resolveOrderStatusFilter(params.get("status")).where,
      ...resolveTechnicianFilter(params.get("technician"), []).where,
    }
    expect(listWhere).toEqual(UNASSIGNED_IN_SERVICE_WHERE)
  })

  test("teslim edilmiş ve iptal edilmiş emirler sayılmaz", () => {
    expect(UNASSIGNED_IN_SERVICE_WHERE.status.in).not.toContain("delivered")
    expect(UNASSIGNED_IN_SERVICE_WHERE.status.in).not.toContain("cancelled")
    expect(UNASSIGNED_IN_SERVICE_WHERE.status.in).toContain("ready_for_delivery")
  })

  test("bağlantı Araç Kabulleri listesini açar", () => {
    expect(new URL(UNASSIGNED_IN_SERVICE_HREF, "http://localhost").pathname).toBe("/orders")
  })
})

describe("ustasız listeden mi gelindi? (#866)", () => {
  test("Genel Bakış kartının açtığı liste ustasız listedir", () => {
    expect(isUnassignedListHref(UNASSIGNED_IN_SERVICE_HREF)).toBe(true)
  })

  test("durum filtresi ne olursa olsun Usta = Atanmamış yeterli", () => {
    expect(isUnassignedListHref("/orders?technician=none")).toBe(true)
    expect(isUnassignedListHref("/orders?technician=none&status=active&q=34")).toBe(true)
  })

  test("başka listeler ve eksik değer ustasız sayılmaz", () => {
    expect(isUnassignedListHref("/orders")).toBe(false)
    expect(isUnassignedListHref("/orders?technician=t1")).toBe(false)
    expect(isUnassignedListHref("/orders?status=in_service")).toBe(false)
    expect(isUnassignedListHref(undefined)).toBe(false)
    expect(isUnassignedListHref("")).toBe(false)
  })
})
