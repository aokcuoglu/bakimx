import { expect, test } from "bun:test"
import { splitHeaderActions } from "@/lib/orders/header-actions"
import { NEXT_STATUSES } from "@/components/orders/order-management-panel"
import { ORDER_STATUSES, orderStatusOptions } from "@/lib/status-transitions"

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

test("draft: Başla buton, İptal menüde", () => {
  expect(split("draft")).toEqual({ primary: "in_progress", overflow: ["cancelled"] })
})

test("waiting_approval: Başla buton, İptal menüde", () => {
  expect(split("waiting_approval")).toEqual({ primary: "in_progress", overflow: ["cancelled"] })
})

test("approved: Başla buton, Parça Bekliyor ve İptal menüde", () => {
  expect(split("approved")).toEqual({ primary: "in_progress", overflow: ["waiting_parts", "cancelled"] })
})

test("in_progress: Teslime Hazır buton, Parça Bekliyor ve İptal menüde", () => {
  expect(split("in_progress")).toEqual({ primary: "ready_for_delivery", overflow: ["waiting_parts", "cancelled"] })
})

test("waiting_parts: Devam Et buton, Teslime Hazır ve İptal menüde", () => {
  expect(split("waiting_parts")).toEqual({ primary: "in_progress", overflow: ["ready_for_delivery", "cancelled"] })
})

test("ready_for_delivery: Teslim buton, İşleme Geri Al ve İptal menüde", () => {
  expect(split("ready_for_delivery")).toEqual({ primary: "delivered", overflow: ["in_progress", "cancelled"] })
  const back = NEXT_STATUSES.ready_for_delivery.find((a) => a.key === "in_progress")
  expect(back?.label).toBe("İşleme Geri Al")
})

test("delivered: hiç aksiyon yok", () => {
  expect(split("delivered")).toEqual({ primary: null, overflow: [] })
})

test("cancelled: tek birincil aksiyon", () => {
  expect(split("cancelled")).toEqual({ primary: "draft", overflow: [] })
})

/**
 * #912 — durum yalnız başlıktan değişir (bilgi kartındaki Durum Select'i kalktı).
 * Başlık haritası durum makinesinin her hedefini sunmak ZORUNDA; yoksa geçiş
 * UI'dan erişilemez olur (Select kalkınca beşi kaybolacaktı: dört durumdan iptal
 * ve teslime hazırdan işe geri dönüş). Referans `orderStatusOptions`.
 */
test("her durum için başlık hedefleri durum makinesinin hedefleriyle birebir aynı", () => {
  for (const status of ORDER_STATUSES) {
    const header = (NEXT_STATUSES[status] ?? []).map((a) => a.key as string).sort()
    const machine = orderStatusOptions(status).slice(1).map(String).sort()
    expect({ status, targets: header }).toEqual({ status, targets: machine })
  }
})

test("her durumda en fazla bir birincil aksiyon; iptal hiçbir zaman birincil değil", () => {
  for (const status of ORDER_STATUSES) {
    const actions = NEXT_STATUSES[status] ?? []
    expect(actions.filter((a) => a.primary).length).toBeLessThanOrEqual(1)
    expect(actions.find((a) => a.key === "cancelled")?.primary).toBeFalsy()
    // Aynı hedef iki kez sunulmaz.
    expect(new Set(actions.map((a) => a.key)).size).toBe(actions.length)
  }
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
