import { expect, test } from "bun:test"
import { returnFocusTo } from "@/hooks/use-return-focus"

function fakeEvent() {
  const event = { defaultPrevented: false, preventDefault: () => { event.defaultPrevented = true } }
  return event
}

function fakeElement(isConnected: boolean) {
  const calls: (FocusOptions | undefined)[] = []
  return { isConnected, calls, focus: (options?: FocusOptions) => void calls.push(options) }
}

test("bağlı açıcıya odak döner ve Radix varsayılanı durur", () => {
  const event = fakeEvent()
  const opener = fakeElement(true)
  expect(returnFocusTo(event, opener, { preventScroll: true })).toBe(true)
  expect(event.defaultPrevented).toBe(true)
  expect(opener.calls).toEqual([{ preventScroll: true }])
})

// Kalem düğmesi pencere açıkken çizilmez; kapanınca yeni öğeyi ref gösterir.
test("ref hedefi kapanış anındaki öğeye çözülür", () => {
  const event = fakeEvent()
  const remounted = fakeElement(true)
  const ref = { current: remounted }
  expect(returnFocusTo(event, ref)).toBe(true)
  expect(remounted.calls).toEqual([undefined])
})

test("DOM'dan kalkmış ya da olmayan hedefte Radix varsayılanı sürer", () => {
  for (const target of [null, fakeElement(false), { current: null }, { current: fakeElement(false) }]) {
    const event = fakeEvent()
    expect(returnFocusTo(event, target)).toBe(false)
    expect(event.defaultPrevented).toBe(false)
  }
})

// "Bilgi ekle" kaydedilince DOM'dan kalkar; Şikayet penceresi kalem düğmesine döner.
test("açan öğe kalktıysa yedeğe dönülür, sıra korunur", () => {
  const event = fakeEvent()
  const gone = fakeElement(false)
  const fallback = fakeElement(true)
  expect(returnFocusTo(event, [gone, { current: fallback }], { preventScroll: true })).toBe(true)
  expect(gone.calls).toEqual([])
  expect(fallback.calls).toEqual([{ preventScroll: true }])

  const first = fakeElement(true)
  const second = fakeElement(true)
  expect(returnFocusTo(fakeEvent(), [first, second])).toBe(true)
  expect(first.calls).toHaveLength(1)
  expect(second.calls).toHaveLength(0)
})

test("boş aday listesinde Radix varsayılanı sürer", () => {
  const event = fakeEvent()
  expect(returnFocusTo(event, [])).toBe(false)
  expect(returnFocusTo(event, [null, undefined])).toBe(false)
  expect(event.defaultPrevented).toBe(false)
})

test("BODY hiçbir zaman dönüş hedefi olmaz (Safari'de tıklanan düğme odak almaz)", async () => {
  const { readFileSync } = await import("node:fs")
  const { join } = await import("node:path")
  const HOOK = readFileSync(join(import.meta.dir, "use-return-focus.ts"), "utf8")
  expect(HOOK).toContain("value !== document.body")
})
