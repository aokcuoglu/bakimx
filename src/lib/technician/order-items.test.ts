import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { applyCompletion, completionSummary, incompleteIds, type CompletableItem } from "./order-items"

const SRC = join(import.meta.dir, "..", "..")
const CHECKLIST = readFileSync(join(SRC, "components", "technician", "order-items-checklist.tsx"), "utf8")
const ACTIONS = readFileSync(join(SRC, "app", "(app)", "technician", "actions.ts"), "utf8")
const CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8")

const ITEMS: CompletableItem[] = [
  { id: "a", completedAt: "2026-01-01T00:00:00.000Z" },
  { id: "b", completedAt: null },
  { id: "c", completedAt: null },
]

test("iyimser yama yalnız hedeflenen kalemi değiştirir", () => {
  const next = applyCompletion(ITEMS, ["b"], true, "2026-02-02T00:00:00.000Z")
  expect(next.map((i) => i.completedAt)).toEqual([
    "2026-01-01T00:00:00.000Z",
    "2026-02-02T00:00:00.000Z",
    null,
  ])
})

test("iyimser yama işareti geri de alabilir", () => {
  expect(applyCompletion(ITEMS, ["a"], false)[0].completedAt).toBeNull()
})

test("iyimser yama girdiyi mutasyona uğratmaz", () => {
  applyCompletion(ITEMS, ["b"], true)
  expect(ITEMS[1].completedAt).toBeNull()
})

test("sayaç tamamlanan ile kalanı ayırır", () => {
  expect(completionSummary(ITEMS)).toEqual({ total: 3, done: 1, remaining: 2 })
  expect(completionSummary([])).toEqual({ total: 0, done: 0, remaining: 0 })
})

test("toplu tamamlamanın hedefi yalnız eksik kalemler", () => {
  expect(incompleteIds(ITEMS)).toEqual(["b", "c"])
  expect(incompleteIds(applyCompletion(ITEMS, ["b", "c"], true))).toEqual([])
})

/** Zaten işaretli kalemin gerçek tamamlama saati toplu işlemde kaybolmamalı. */
test("toplu tamamlama önceki zaman damgasını ezmez", () => {
  const next = applyCompletion(ITEMS, incompleteIds(ITEMS), true, "2026-02-02T00:00:00.000Z")
  expect(next[0].completedAt).toBe("2026-01-01T00:00:00.000Z")
  expect(completionSummary(next).remaining).toBe(0)
})

/**
 * BAK-21'in asıl şikâyeti gecikmeydi: tik ancak sunucu yanıtından SONRA
 * geliyordu. `useOptimistic` kaldırılırsa ekran yine "çalışır" görünür ama his
 * geri gider; ne TypeScript ne lint bunu yakalar.
 */
test("işaretleme iyimser durumla anında yansır", () => {
  expect(CHECKLIST).toMatch(/useOptimistic/)
})

test("animasyonlar hareket azaltma tercihine saygılı", () => {
  expect([...CHECKLIST.matchAll(/(?<!motion-safe:)animate-(?:check-pop|item-done)/g)]).toEqual([])
  expect(CHECKLIST).toMatch(/motion-safe:animate-check-pop/)
  expect(CHECKLIST).toMatch(/motion-safe:animate-item-done/)
})

/**
 * Tailwind, karşılığı olmayan bir `animate-*` sınıfı için sessizce hiçbir kural
 * üretmez — sınıf doğru görünür, animasyon hiç çalışmaz (bkz. theme-tokens).
 */
test("kullanılan animasyonların token ve keyframe karşılığı var", () => {
  for (const name of ["check-pop", "item-done"]) {
    expect(CSS).toMatch(new RegExp(`--animate-${name}:`))
    expect(CSS).toMatch(new RegExp(`@keyframes ${name}\\b`))
  }
})

test("toplu tamamlama sunucu tarafında kiracı izolasyonunu korur", () => {
  const start = ACTIONS.indexOf("export async function completeAllOrderItemsAction")
  expect(start).toBeGreaterThan(-1)
  const body = ACTIONS.slice(start, ACTIONS.indexOf("\n}\n", start))
  expect(body).toMatch(/workshopId: user\.workshopId/)
  // Kilitli iş emri (teslim/iptal) toplu işlemle de düzenlenememeli.
  expect(body).toMatch(/isOrderLocked/)
  // Yalnız eksik kalemler yazılır; işaretli olanların damgası korunur.
  expect(body).toMatch(/completedAt: null/)
})

test("toplu kaldırma yalnız bu iş emrinin tamamlanan kalemlerini geri alır", () => {
  expect(CHECKLIST).toContain("Tümünü kaldır")
  expect(CHECKLIST).toContain("uncompleteAllOrderItemsAction")

  const start = ACTIONS.indexOf("export async function uncompleteAllOrderItemsAction")
  expect(start).toBeGreaterThan(-1)
  const body = ACTIONS.slice(start, ACTIONS.indexOf("\n}\n", start))
  expect(body).toMatch(/workshopId: user\.workshopId/)
  expect(body).toMatch(/completedAt: \{ not: null \}/)
  expect(body).toMatch(/completedById: null/)
  expect(body).toMatch(/isOrderLocked/)
})
