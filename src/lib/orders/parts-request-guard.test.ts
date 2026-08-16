import { test, expect } from "bun:test"
import {
  findUndecidedPartsRequests,
  isPartsRequestDecided,
  orderStatusNeedsPartsDecision,
  undecidedPartsRequestsMessage,
} from "./parts-request-guard"

const req = (
  partName: string,
  status: string,
  convertedAt: Date | string | null = null,
  cancelledAt: Date | string | null = null,
) => ({ partName, status, convertedAt, cancelledAt })

test("kaleme çevrilmemiş, iptal edilmemiş talep karar bekler", () => {
  expect(isPartsRequestDecided(req("Yağ pompası", "requested"))).toBe(false)
  expect(isPartsRequestDecided(req("Takım conta", "prepared"))).toBe(false)
  // Usta parçayı teslim almış olsa bile ofis kararı (kalem/iptal) hâlâ eksik.
  expect(isPartsRequestDecided(req("Yağ filtresi", "delivered"))).toBe(false)
})

test("kaleme eklenmiş talep karara bağlanmıştır", () => {
  expect(isPartsRequestDecided(req("Yağ filtresi", "delivered", new Date()))).toBe(true)
})

test("iptal edilmiş talep karara bağlanmıştır", () => {
  expect(isPartsRequestDecided(req("Turbo hortumu", "cancelled", null, new Date()))).toBe(true)
})

test("karar bekleyenler sıraları korunarak döner", () => {
  const requests = [
    req("Yağ pompası", "requested"),
    req("Yağ filtresi", "prepared", "2026-08-16T10:00:00Z"),
    req("Takım conta", "prepared"),
    req("Turbo hortumu", "cancelled", null, "2026-08-16T11:00:00Z"),
  ]
  expect(findUndecidedPartsRequests(requests).map((r) => r.partName)).toEqual([
    "Yağ pompası",
    "Takım conta",
  ])
})

test("talebi olmayan iş emrinde karar eksiği yoktur", () => {
  expect(findUndecidedPartsRequests([])).toEqual([])
})

test("kapı yalnız teslime hazır ve teslim edildi durumlarında işler", () => {
  expect(orderStatusNeedsPartsDecision("ready_for_delivery")).toBe(true)
  expect(orderStatusNeedsPartsDecision("delivered")).toBe(true)
  expect(orderStatusNeedsPartsDecision("in_progress")).toBe(false)
  expect(orderStatusNeedsPartsDecision("waiting_parts")).toBe(false)
  // İptal, açık talepleri toplu iptal ederek ilerler; kapı burada uygulanmaz.
  expect(orderStatusNeedsPartsDecision("cancelled")).toBe(false)
})

test("hata metni ilk iki ismi yazar, kalanı (+N) ile sayar", () => {
  const msg = undecidedPartsRequestsMessage([
    req("Yağ pompası", "requested"),
    req("Takım conta", "requested"),
    req("Devirdaim", "requested"),
  ])
  expect(msg).toContain("Yağ pompası, Takım conta (+1)")
  expect(msg).toContain("iptal edin")
})

test("hata metni iki veya daha az talepte (+N) eklemez", () => {
  const msg = undecidedPartsRequestsMessage([req("Yağ pompası", "requested"), req("Takım conta", "requested")])
  expect(msg).toContain("Yağ pompası, Takım conta.")
  expect(msg).not.toContain("(+")
})
