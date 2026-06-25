import { expect, test } from "bun:test"
import {
  workshopApprovedEmail,
  workshopRejectedEmail,
  applicationReceivedEmail,
  newApplicationAdminEmail,
} from "./system-emails"

test("workshopApprovedEmail: giriş CTA'sı + 15 gün deneme mesajı", () => {
  const e = workshopApprovedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.subject).toContain("onayland")
  expect(e.html).toContain("Ali")
  expect(e.html).toContain("Usta Oto")
  expect(e.html).toContain("/login")
  expect(e.html).toContain("15 gün")
})

test("workshopRejectedEmail: CTA yok, iletişim notu var", () => {
  const e = workshopRejectedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.html).not.toContain("href=")
  expect(e.html).toContain("hey@bakimx.com")
})

test("applicationReceivedEmail: onay bekleniyor mesajı", () => {
  const e = applicationReceivedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.subject).toContain("alındı")
  expect(e.html).toContain("onay")
})

test("newApplicationAdminEmail: başvuran alanları + admin CTA", () => {
  const e = newApplicationAdminEmail({
    workshopName: "Usta Oto",
    ownerName: "Ali Veli",
    email: "a@b.com",
    phone: "5551112233",
    city: "İzmir",
  })
  expect(e.html).toContain("a@b.com")
  expect(e.html).toContain("5551112233")
  expect(e.html).toContain("/admin")
})

test("sistem e-postaları kullanıcı değerlerini HTML-escape eder", () => {
  const e = applicationReceivedEmail({ firstName: "<script>", workshopName: "A&B" })
  expect(e.html).not.toContain("<script>")
  expect(e.html).toContain("&lt;script&gt;")
  expect(e.html).toContain("A&amp;B")
})
