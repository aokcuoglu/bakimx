import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { captureOpener, openerCandidates } from "@/hooks/use-opener-focus"
import { returnFocusTo } from "@/hooks/use-return-focus"

function fakeEvent() {
  const event = { defaultPrevented: false, preventDefault: () => { event.defaultPrevented = true } }
  return event
}

function fakeElement(isConnected: boolean, menuTriggerId?: string) {
  const calls: number[] = []
  return {
    isConnected,
    calls,
    focus: () => void calls.push(1),
    closest: (selector: string) =>
      selector === '[role="menu"]' && menuTriggerId ? { getAttribute: () => menuTriggerId } : null,
  }
}

function fakeDoc(active: unknown, byId: Record<string, unknown> = {}) {
  const body = {}
  return { body, activeElement: active ?? body, getElementById: (id: string) => byId[id] ?? null }
}

test("kontrollü pencere kapanınca odak açan düğmeye döner", () => {
  const button = fakeElement(true)
  const snapshot = captureOpener(fakeDoc(button))
  const event = fakeEvent()
  expect(returnFocusTo(event, openerCandidates(snapshot, fakeDoc(null)))).toBe(true)
  expect(event.defaultPrevented).toBe(true)
  expect(button.calls).toHaveLength(1)
})

test("BODY açan öğe sayılmaz; Radix varsayılanı sürer", () => {
  const snapshot = captureOpener(fakeDoc(null))
  const event = fakeEvent()
  expect(returnFocusTo(event, openerCandidates(snapshot, fakeDoc(null)))).toBe(false)
  expect(event.defaultPrevented).toBe(false)
})

test("açan öğe DOM'dan kalkmışsa odak verilmez", () => {
  const gone = fakeElement(false)
  const snapshot = captureOpener(fakeDoc(gone))
  const event = fakeEvent()
  expect(returnFocusTo(event, openerCandidates(snapshot, fakeDoc(null)))).toBe(false)
  expect(gone.calls).toHaveLength(0)
  expect(event.defaultPrevented).toBe(false)
})

test("menü maddesinden açılınca madde kalkar, odak menünün tetikleyicisine döner", () => {
  const item = fakeElement(false, "menu-trigger")
  const trigger = fakeElement(true)
  const snapshot = captureOpener(fakeDoc(item))
  const event = fakeEvent()
  expect(returnFocusTo(event, openerCandidates(snapshot, fakeDoc(null, { "menu-trigger": trigger })))).toBe(true)
  expect(trigger.calls).toHaveLength(1)
  expect(item.calls).toHaveLength(0)
})

// Kaynak kapısı: üç paylaşılan içerik bileşeni de mekanizmayı bağlar; çağıranın
// onCloseAutoFocus'ı hook içinde önce çalışır (ezilmez).
for (const file of ["dialog", "sheet", "alert-dialog"]) {
  test(`ui/${file}.tsx odak dönüşünü bağlar ve Escape guard'ını korur`, () => {
    const source = readFileSync(`src/components/ui/${file}.tsx`, "utf8")
    expect(source).toContain("useOpenerFocus(onCloseAutoFocus)")
    expect(source).toContain("onCloseAutoFocus={returnFocusToOpener}")
    expect(source).toContain("yieldEscapeToBaseUIPopup(event, onEscapeKeyDown)")
  })
}
