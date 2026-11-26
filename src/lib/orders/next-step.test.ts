import { expect, test } from "bun:test"
import { NEXT_STATUSES } from "@/components/orders/order-management-panel"
import { orderNextStep, previewNames } from "@/lib/orders/next-step"

const names = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix} ${i + 1}`)

const step = (status: string, unpricedCount = 0, undecidedCount = 0) =>
  orderNextStep({
    status,
    actions: NEXT_STATUSES[status] ?? [],
    unpricedNames: names("Kalem", unpricedCount),
    undecidedNames: names("Talep", undecidedCount),
  })

const kinds = (issues: { kind: string }[] | undefined) => issues?.map((issue) => issue.kind)

test("sıradaki adım başlıktaki birincil aksiyonla aynıdır", () => {
  expect(step("draft")?.label).toBe("Başla")
  expect(step("waiting_approval")?.label).toBe("Başla")
  expect(step("approved")?.label).toBe("Başla")
  expect(step("in_progress")?.label).toBe("Teslime Hazır")
  expect(step("waiting_parts")?.label).toBe("Devam Et")
  expect(step("ready_for_delivery")?.label).toBe("Teslim Et")
})

test("teslim edilmiş ve iptal emirde sıradaki adım yok", () => {
  expect(step("delivered")).toBeNull()
  expect(step("cancelled")).toBeNull()
  expect(step("cancelled", 2, 1)).toBeNull()
})

test("açık iş yoksa engel de not da yok", () => {
  expect(step("in_progress")).toEqual({ label: "Teslime Hazır", blockers: [], notes: [] })
})

// Başlıktaki kural: karar bekleyen talep "Teslime Hazır"ı ve teslimi kapatır.
test("karar bekleyen parça talebi Teslime Hazır adımında engeldir", () => {
  const result = step("in_progress", 0, 2)
  expect(kinds(result?.blockers)).toEqual(["undecided"])
  expect(result?.notes).toEqual([])
  expect(result?.blockers[0]).toEqual({
    kind: "undecided",
    text: "2 parça talebi karar bekliyor",
    preview: "Talep 1, Talep 2",
    hint:
      "Her talebi ya kaleme ekleyin ya da iptal edin; karar verilmeden araç kabulü teslime " +
      "hazırlanamaz ve teslim edilemez.",
    linkLabel: "Kalemlerde karar ver",
  })
})

// #913 — eski uyarı şeritlerinde ikisi ayrı ayrı görünüyordu; Durum kartında
// yalnız ilki çıkarsa öteki ancak ilki çözülünce sürpriz olarak beliriyordu.
test("teslim adımında iki engel birlikte listelenir", () => {
  const result = step("ready_for_delivery", 3, 1)
  expect(kinds(result?.blockers)).toEqual(["undecided", "unpriced"])
  expect(result?.blockers.map((b) => b.text)).toEqual(["1 parça talebi karar bekliyor", "3 kalemin fiyatı girilmemiş"])
  expect(result?.notes).toEqual([])
})

test("sıradaki adımı kapatmıyorsa karar bekleyen talep nötr not olur", () => {
  for (const status of ["draft", "waiting_parts"]) {
    const result = step(status, 0, 1)
    expect(result?.blockers).toEqual([])
    expect(kinds(result?.notes)).toEqual(["undecided"])
    expect(result?.notes[0].linkLabel).toBe("Kalemlerde karar ver")
  }
})

test("fiyatsız kalem yalnız teslim adımında engeldir, önceki adımlarda yazılmaz", () => {
  expect(step("in_progress", 3)).toEqual({ label: "Teslime Hazır", blockers: [], notes: [] })
  expect(step("draft", 3)).toEqual({ label: "Başla", blockers: [], notes: [] })
  expect(step("ready_for_delivery", 3)?.blockers).toEqual([
    {
      kind: "unpriced",
      text: "3 kalemin fiyatı girilmemiş",
      preview: "Kalem 1, Kalem 2, +1",
      hint: "Teslim için tüm kalemlere fiyat girin (0 TL girilebilir).",
      linkLabel: "Kalemlerde tamamla",
    },
  ])
})

test("ad önizlemesi ilk iki ad ve kalanın sayısı", () => {
  expect(previewNames([])).toBeNull()
  expect(previewNames(["a"])).toBe("a")
  expect(previewNames(["a", "b"])).toBe("a, b")
  expect(previewNames(["a", "b", "c", "d", "e"])).toBe("a, b, +3")
})

test("birincil aksiyonu olmayan liste adım üretmez", () => {
  expect(orderNextStep({ status: "in_progress", actions: [], unpricedNames: [], undecidedNames: [] })).toBeNull()
})
