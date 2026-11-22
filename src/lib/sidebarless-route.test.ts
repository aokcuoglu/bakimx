import { describe, expect, test } from "bun:test"
import { isSidebarlessRoute, isTechnicianFlow } from "./sidebarless-route"
import { TECHNICIAN_QUICK_ACTIONS } from "@/components/technician/technician-quick-actions"

const qs = (value: string) => new URLSearchParams(value)

describe("isSidebarlessRoute", () => {
  test("teknisyen paneli ve alt sayfaları sidebar'sız", () => {
    expect(isSidebarlessRoute("/technician")).toBe(true)
    expect(isSidebarlessRoute("/technician/parts")).toBe(true)
    expect(isSidebarlessRoute("/technician/orders/abc")).toBe(true)
  })

  test("panelden açılan Araç Kabul sidebar'sız", () => {
    expect(isSidebarlessRoute("/orders/new", qs("entry=plate&from=technician"))).toBe(true)
    // Akış içinde URL'e eklenen seçimler odaklı modu bozmaz.
    expect(isSidebarlessRoute("/orders/new", qs("entry=plate&from=technician&customerId=c&vehicleId=v"))).toBe(true)
  })

  test("aynı sayfa ofisten açılınca tam kabuk kalır", () => {
    expect(isSidebarlessRoute("/orders/new")).toBe(false)
    expect(isSidebarlessRoute("/orders/new", qs("entry=plate"))).toBe(false)
    expect(isSidebarlessRoute("/orders/new", qs("from=dashboard"))).toBe(false)
  })

  test("from=technician başka sayfaları sidebar'sız yapmaz", () => {
    expect(isSidebarlessRoute("/orders", qs("from=technician"))).toBe(false)
    expect(isSidebarlessRoute("/dashboard", qs("from=technician"))).toBe(false)
    expect(isSidebarlessRoute("/technicians")).toBe(false)
  })

  test("paneldeki Araç Kabul kartı odaklı akışa düşer", () => {
    const intake = TECHNICIAN_QUICK_ACTIONS.find((action) => action.href.startsWith("/orders/new"))
    expect(intake).toBeDefined()
    const url = new URL(intake!.href, "http://localhost")
    expect(isTechnicianFlow(url.searchParams)).toBe(true)
    expect(isSidebarlessRoute(url.pathname, url.searchParams)).toBe(true)
  })
})
