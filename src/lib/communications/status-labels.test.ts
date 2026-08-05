import { expect, test } from "bun:test"
import {
  COMMUNICATION_STATUSES,
  communicationStatusLabel,
} from "./status-labels"

test("skipped bir durum olarak tanınır ve Türkçe etiketi vardır (issue #246)", () => {
  expect(COMMUNICATION_STATUSES).toContain("skipped")
  expect(communicationStatusLabel("skipped")).toBe("Gönderilmedi")
})

test("skipped, başarısızlıkla aynı dile düşmez", () => {
  // Müşteri onay vermediği için gönderilmedi — sistemde arıza yok.
  expect(communicationStatusLabel("skipped")).not.toBe(communicationStatusLabel("failed"))
})

test("sender.ts'in yazabildiği her durumun etiketi var", () => {
  // sendCommunication: "sent" | "failed" | "skipped"; şema varsayılanı: "pending".
  for (const status of ["sent", "failed", "skipped", "pending"]) {
    expect(COMMUNICATION_STATUSES).toContain(status)
    expect(communicationStatusLabel(status)).not.toBe(status)
  }
})

test("tanınmayan durum ham hâliyle döner", () => {
  expect(communicationStatusLabel("brand_new_status")).toBe("brand_new_status")
})
