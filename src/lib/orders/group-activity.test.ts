import { expect, test } from "bun:test"
import { countActivityRows, groupActivity, limitActivityRows, restActivityRows, runTimeRange, summarizeRun } from "./group-activity"

let n = 0
const e = (at: string, actor = "Ali", action = "photo.add") => ({ id: `e${++n}`, at, actor, action })
// 2026-11-26 12:00 İstanbul
const NOW = new Date("2026-11-26T09:00:00Z")

test("boş girdi boş gün listesi verir", () => {
  expect(groupActivity([], NOW)).toEqual([])
})

test("Bugün / Dün / tarih etiketleri", () => {
  const days = groupActivity(
    [e("2026-11-26T08:00:00Z"), e("2026-11-25T08:00:00Z"), e("2026-11-20T08:00:00Z")],
    NOW,
  )
  expect(days.map((d) => d.label)).toEqual(["Bugün", "Dün", "20 Kasım 2026"])
})

test("gün sınırı İstanbul gece yarısıdır (UTC değil)", () => {
  // 21:00Z = 00:00 İstanbul (27 Kasım)... NOW'u 27'ye al
  const now = new Date("2026-11-27T10:00:00Z")
  const days = groupActivity([e("2026-11-26T21:00:00Z", "A", "x"), e("2026-11-26T20:59:00Z", "A", "x")], now)
  expect(days.map((d) => d.key)).toEqual(["2026-11-27", "2026-11-26"])
  expect(days.map((d) => d.label)).toEqual(["Bugün", "Dün"])
})

test("UTC'de dünkü ama İstanbul'da bugün olan kayıt Bugün'e düşer", () => {
  const days = groupActivity([e("2026-11-25T22:00:00Z")], NOW) // 26 Kasım 01:00 TR
  expect(days[0].label).toBe("Bugün")
})

test("ay sınırında Dün doğru hesaplanır", () => {
  const now = new Date("2026-12-01T09:00:00Z")
  const days = groupActivity([e("2026-11-30T09:00:00Z")], now)
  expect(days[0].label).toBe("Dün")
})

test("2 ardışık aynı olay daraltılmaz", () => {
  const rows = groupActivity([e("2026-11-26T08:03:00Z"), e("2026-11-26T08:02:00Z")], NOW)[0].rows
  expect(rows.map((r) => r.kind)).toEqual(["single", "single"])
})

test("3 ardışık aynı olay tek seride toplanır", () => {
  const rows = groupActivity(
    [e("2026-11-26T08:03:00Z"), e("2026-11-26T08:02:00Z"), e("2026-11-26T08:01:00Z")],
    NOW,
  )[0].rows
  expect(rows).toHaveLength(1)
  expect(rows[0].kind === "run" && rows[0].entries.length).toBe(3)
})

test("kişi değişince seri biter", () => {
  const rows = groupActivity(
    [
      e("2026-11-26T08:05:00Z"),
      e("2026-11-26T08:04:00Z"),
      e("2026-11-26T08:03:00Z", "Veli"),
      e("2026-11-26T08:02:00Z"),
      e("2026-11-26T08:01:00Z"),
    ],
    NOW,
  )[0].rows
  expect(rows.map((r) => r.kind)).toEqual(["single", "single", "single", "single", "single"])
})

test("olay değişince seri biter, kalan seri ayrı daralır", () => {
  const rows = groupActivity(
    [
      e("2026-11-26T08:05:00Z"),
      e("2026-11-26T08:04:00Z"),
      e("2026-11-26T08:03:00Z"),
      e("2026-11-26T08:02:00Z", "Ali", "part.add"),
    ],
    NOW,
  )[0].rows
  expect(rows.map((r) => r.kind)).toEqual(["run", "single"])
})

test("seri gün sınırını aşmaz", () => {
  const days = groupActivity(
    [e("2026-11-26T08:00:00Z"), e("2026-11-26T07:00:00Z"), e("2026-11-25T08:00:00Z"), e("2026-11-25T07:00:00Z")],
    NOW,
  )
  expect(days.map((d) => d.rows.map((r) => r.kind))).toEqual([
    ["single", "single"],
    ["single", "single"],
  ])
})

test("sıra korunur", () => {
  const input = [e("2026-11-26T08:03:00Z", "A", "a"), e("2026-11-26T08:02:00Z", "B", "b")]
  const rows = groupActivity(input, NOW)[0].rows
  expect(rows.map((r) => (r.kind === "single" ? r.entry.id : ""))).toEqual(input.map((x) => x.id))
})

test("limitActivityRows ilk N satırı alır, boş günü atar, seri tek satırdır", () => {
  const days = groupActivity(
    [
      e("2026-11-26T08:05:00Z"),
      e("2026-11-26T08:04:00Z"),
      e("2026-11-26T08:03:00Z"),
      e("2026-11-26T08:02:00Z", "Ali", "part.add"),
      e("2026-11-25T08:00:00Z"),
    ],
    NOW,
  )
  expect(countActivityRows(days)).toBe(3)
  const limited = limitActivityRows(days, 2)
  expect(limited).toHaveLength(1)
  expect(countActivityRows(limited)).toBe(2)
})

test("summarizeRun: aynı etiketse etiket + kez", () => {
  const x = { action: "photo_uploaded", label: "Fotoğraf eklendi" }
  expect(summarizeRun([x, x, x])).toBe("Fotoğraf eklendi · 3 kez")
})

test("summarizeRun: farklı kalemler genel özet verir", () => {
  const mk = (label: string) => ({ action: "order_item_removed", label })
  expect(summarizeRun([mk("a çıkarıldı"), mk("b çıkarıldı"), mk("c çıkarıldı"), mk("d çıkarıldı")])).toBe(
    "4 kalem çıkarıldı",
  )
  const add = (label: string) => ({ action: "order_item_added", label })
  expect(summarizeRun([add("a eklendi"), add("b eklendi"), add("c eklendi")])).toBe("3 kalem eklendi")
})

test("summarizeRun: bilinmeyen eylemde etiketler farklıysa genel sayım", () => {
  const mk = (label: string) => ({ action: "order_status_changed_to_x", label })
  expect(summarizeRun([mk("a"), mk("b"), mk("c")])).toBe("3 işlem")
})

test("runTimeRange: aynı dakikada tek saat, değilse aralık (eskiden yeniye)", () => {
  expect(runTimeRange([{ at: "2026-11-26T15:59:50Z" }, { at: "2026-11-26T15:59:10Z" }])).toBe("18:59")
  expect(runTimeRange([{ at: "2026-11-26T16:05:00Z" }, { at: "2026-11-26T15:59:10Z" }])).toBe("18:59–19:05")
})

test("restActivityRows limitActivityRows'un tamamlayıcısıdır; bölünen gün continued olur", () => {
  const days = groupActivity(
    [
      e("2026-11-26T08:05:00Z", "Ali", "a.x"),
      e("2026-11-26T08:04:00Z", "Veli", "b.x"),
      e("2026-11-26T08:03:00Z", "Ali", "c.x"),
      e("2026-11-25T08:00:00Z", "Ali", "d.x"),
    ],
    NOW,
  )
  const rest = restActivityRows(days, 2)
  expect(rest.map((d) => [d.key, d.rows.length, d.continued])).toEqual([
    ["2026-11-26", 1, true],
    ["2026-11-25", 1, false],
  ])
  expect(countActivityRows(limitActivityRows(days, 2)) + countActivityRows(rest)).toBe(countActivityRows(days))
  expect(restActivityRows(days, 4)).toEqual([])
})
