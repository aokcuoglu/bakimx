import { expect, test } from "bun:test"
import {
  salesAdvisorDisplayName,
  salesLeadAdminHref,
  salesLeadAnchorId,
  workshopAdminHref,
} from "@/lib/sales/links"

test("iş yeri ve satış adayı yönetim ekranları karşılıklı bağlanır", () => {
  expect(salesLeadAnchorId("lead-1")).toBe("sales-lead-lead-1")
  expect(salesLeadAdminHref("lead-1")).toBe("/admin/sales?lead=lead-1#sales-lead-lead-1")
  expect(workshopAdminHref("workshop-1")).toBe("/admin/workshops/workshop-1")
})

test("satış temsilcisinde ad soyad, yoksa e-posta kullanılır", () => {
  expect(salesAdvisorDisplayName({ firstName: "Ayşe", lastName: "Yılmaz", email: "ayse@example.com" })).toBe(
    "Ayşe Yılmaz"
  )
  expect(salesAdvisorDisplayName({ firstName: null, lastName: null, email: "sales@example.com" })).toBe(
    "sales@example.com"
  )
  expect(salesAdvisorDisplayName({ firstName: null, lastName: null, email: null })).toBeNull()
})
