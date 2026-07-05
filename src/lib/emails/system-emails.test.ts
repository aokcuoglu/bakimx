import { expect, test } from "bun:test"
import {
  workshopApprovedEmail,
  workshopRejectedEmail,
  applicationReceivedEmail,
  newApplicationAdminEmail,
  welcomeTrialEmail,
} from "./system-emails"

test("workshopApprovedEmail: giriş CTA'sı + 7 gün deneme mesajı", () => {
  const e = workshopApprovedEmail({ firstName: "Ali", workshopName: "Usta Oto" })
  expect(e.subject).toContain("onayland")
  expect(e.html).toContain("Ali")
  expect(e.html).toContain("Usta Oto")
  expect(e.html).toContain("/login")
  expect(e.html).toContain("7 gün")
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

test("welcomeTrialEmail: hoş geldin + deneme bitiş tarihi + giriş CTA'sı", () => {
  const trialEndsAt = new Date("2026-07-12T00:00:00.000Z")
  const e = welcomeTrialEmail({ ownerName: "Ali", workshopName: "Usta Oto", trialEndsAt })
  expect(e.subject.length).toBeGreaterThan(0)
  expect(e.html.length).toBeGreaterThan(0)
  expect(e.html).toContain("Ali")
  expect(e.html).toContain("Usta Oto")
  expect(e.html).toContain("/login")
  expect(e.html).toContain("7 gün")
  expect(e.html).toContain("12.07.2026")
  expect(e.html).toContain("/billing")
})

test("welcomeTrialEmail: kullanıcı değerlerini HTML-escape eder", () => {
  const e = welcomeTrialEmail({
    ownerName: "<script>",
    workshopName: "A&B",
    trialEndsAt: new Date("2026-07-12T00:00:00.000Z"),
  })
  expect(e.html).not.toContain("<script>")
  expect(e.html).toContain("&lt;script&gt;")
  expect(e.html).toContain("A&amp;B")
})

test("sistem e-postaları kullanıcı değerlerini HTML-escape eder", () => {
  const e = applicationReceivedEmail({ firstName: "<script>", workshopName: "A&B" })
  expect(e.html).not.toContain("<script>")
  expect(e.html).toContain("&lt;script&gt;")
  expect(e.html).toContain("A&amp;B")
})
