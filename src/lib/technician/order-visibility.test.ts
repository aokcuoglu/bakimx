import { expect, test } from "bun:test"
import { technicianOrderDetailWhere, technicianOrderListWhere } from "./order-visibility"

test("saha rolü listesinde atölye sınırı korunur ve teknisyen filtresi uygulanmaz", () => {
  expect(technicianOrderListWhere("workshop-1")).toEqual({
    workshopId: "workshop-1",
    status: { notIn: ["delivered", "cancelled"] },
  })
})

test("yönetici teknisyen seçtiğinde mevcut filtreleme davranışı korunur", () => {
  expect(technicianOrderListWhere("workshop-1", "tech-2", "delivered")).toEqual({
    workshopId: "workshop-1",
    assignedTechnicianId: "tech-2",
    status: "delivered",
  })
})

test("detay sorgusu id ile birlikte tenant filtresini zorunlu tutar", () => {
  expect(technicianOrderDetailWhere("workshop-1", "order-9")).toEqual({
    id: "order-9",
    workshopId: "workshop-1",
  })
})
