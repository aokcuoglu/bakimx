import { expect, test } from "bun:test"
import { splitHeaderActions } from "@/lib/orders/header-actions"
import { NEXT_STATUSES } from "@/components/app/order-management-panel"

type Tone = "primary" | "secondary" | "danger"

/** work-order-detail'in NEXT_STATUSES'tan başlık aksiyonu türetme kuralının aynısı. */
function headerActionsFor(status: string) {
  return (NEXT_STATUSES[status] ?? []).map((a) => ({
    key: a.key as string,
    tone: (a.key === "cancelled" ? "danger" : a.primary ? "primary" : "secondary") as Tone,
  }))
}

function split(status: string) {
  const { primary, overflow } = splitHeaderActions(headerActionsFor(status))
  return { primary: primary?.key ?? null, overflow: overflow.map((a) => a.key) }
}

test("draft: tek birincil aksiyon, taşma menüsü yok", () => {
  expect(split("draft")).toEqual({ primary: "in_progress", overflow: [] })
})

test("waiting_approval: Başla buton, İptal menüde", () => {
  expect(split("waiting_approval")).toEqual({ primary: "in_progress", overflow: ["cancelled"] })
})

test("approved: Başla buton, Parça Bekliyor menüde", () => {
  expect(split("approved")).toEqual({ primary: "in_progress", overflow: ["waiting_parts"] })
})

test("in_progress: Teslime Hazır buton, Parça Bekliyor menüde", () => {
  expect(split("in_progress")).toEqual({ primary: "ready_for_delivery", overflow: ["waiting_parts"] })
})

test("waiting_parts: Devam Et buton, Teslime Hazır menüde", () => {
  expect(split("waiting_parts")).toEqual({ primary: "in_progress", overflow: ["ready_for_delivery"] })
})

test("ready_for_delivery: Teslim buton, İptal menüde", () => {
  expect(split("ready_for_delivery")).toEqual({ primary: "delivered", overflow: ["cancelled"] })
})

test("delivered: hiç aksiyon yok", () => {
  expect(split("delivered")).toEqual({ primary: null, overflow: [] })
})

test("cancelled: tek birincil aksiyon", () => {
  expect(split("cancelled")).toEqual({ primary: "draft", overflow: [] })
})

test("birincil aksiyon yoksa hepsi menüye iner", () => {
  const { primary, overflow } = splitHeaderActions([
    { key: "a", tone: "secondary" as Tone },
    { key: "b", tone: "danger" as Tone },
  ])
  expect(primary).toBeNull()
  expect(overflow.map((a) => a.key)).toEqual(["a", "b"])
})

test("menüde danger her zaman en sonda", () => {
  const { overflow } = splitHeaderActions([
    { key: "iptal", tone: "danger" as Tone },
    { key: "birincil", tone: "primary" as Tone },
    { key: "ikincil", tone: "secondary" as Tone },
  ])
  expect(overflow.map((a) => a.key)).toEqual(["ikincil", "iptal"])
})

test("girdi dizisi mutasyona uğramaz", () => {
  const input = [
    { key: "iptal", tone: "danger" as Tone },
    { key: "birincil", tone: "primary" as Tone },
    { key: "ikincil", tone: "secondary" as Tone },
  ]
  const snapshot = input.map((a) => a.key)
  splitHeaderActions(input)
  expect(input.map((a) => a.key)).toEqual(snapshot)
})

test("boş aksiyon listesi güvenli", () => {
  expect(splitHeaderActions([])).toEqual({ primary: null, overflow: [] })
})
