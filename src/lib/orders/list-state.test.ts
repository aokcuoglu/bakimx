import { describe, expect, test } from "bun:test"
import { orderDetailHref, orderListReturnHref, readOrderListState } from "./list-state"

describe("order list navigation state", () => {
  test("round trips every server filter and client table setting through view/edit links", () => {
    const state = { sorting: [{ id: "dates", desc: true }], columnFilters: [{ id: "customer", value: "İpek & Ortakları" }], columnVisibility: { delivery: true, invoice: false } }
    const params = new URLSearchParams({ q: "34 HMK", status: "active", payment: "unpaid", technician: "unassigned", invoice: "without", view: JSON.stringify(state) })
    const list = `/orders?${params}`
    for (const edit of [false, true]) {
      const detail = new URL(orderDetailHref("order-id", list, edit), "http://localhost")
      expect(orderListReturnHref(detail.searchParams.get("returnTo")!)).toBe(list)
      expect(detail.searchParams.get("edit")).toBe(edit ? "1" : null)
    }
    expect(readOrderListState(params.get("view"))).toEqual(state)
  })

  test("invalid state cannot introduce non-data columns or untyped values", () => {
    const state = readOrderListState(JSON.stringify({ sorting: [null, { id: "actions", desc: false }, { id: "dates", desc: "yes" }], columnFilters: [null, { id: "customer", value: {} }], columnVisibility: { actions: false, customer: "false", invoice: false } }))
    expect(state).toEqual({ sorting: [], columnFilters: [], columnVisibility: { delivery: false, invoice: false } })
    for (const raw of [null, "{", "null", "[]"]) expect(readOrderListState(raw).sorting).toEqual([])
  })

  test("direct visits and untrusted return destinations fall back to the order list", () => {
    for (const raw of [undefined, "https://example.com", "//example.com", "/orders/other", "/orders-malicious", "/orders?x=1\n", "/orders#fragment", "/orders?x=\\evil"]) expect(orderListReturnHref(raw)).toBe("/orders")
    expect(orderListReturnHref("/orders?q=34")).toBe("/orders?q=34")
  })
})
