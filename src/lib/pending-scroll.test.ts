import { describe, expect, test } from "bun:test"
import { createPendingScroll } from "@/lib/pending-scroll"

// Sahte DOM öğesi: yalnız kimliği ve kaydırma çağrısı önemli.
const el = (name: string) => ({ name }) as unknown as HTMLElement

describe("createPendingScroll (#838)", () => {
  test("öğe bağlıyken istek hemen kaydırır", () => {
    const calls: HTMLElement[] = []
    const s = createPendingScroll((node) => calls.push(node))
    const card = el("card")
    s.attach(card)
    s.request()
    expect(calls).toEqual([card])
  })

  // Kök neden: Radix sekme paneli içeriği sekme değiştikten SONRAKİ render'da
  // bağlanır; istek o anda öğeyi bulamaz. Kaydırma, öğe bağlandığında yapılmalı.
  test("öğe henüz yoksa istek bekler, öğe bağlanınca bir kez kaydırır", () => {
    const calls: HTMLElement[] = []
    const s = createPendingScroll((node) => calls.push(node))
    s.request()
    expect(calls).toEqual([])
    const card = el("card")
    s.attach(card)
    expect(calls).toEqual([card])
    // Aynı öğe yeniden bağlanırsa (sekme gidip gelirse) istek tekrar etmez.
    s.attach(null)
    s.attach(card)
    expect(calls).toEqual([card])
  })

  test("panel ayrılınca öğe bırakılır; sonraki istek yeniden bekler", () => {
    const calls: HTMLElement[] = []
    const s = createPendingScroll((node) => calls.push(node))
    s.attach(el("first"))
    s.attach(null)
    s.request()
    expect(calls).toEqual([])
    const second = el("second")
    s.attach(second)
    expect(calls).toEqual([second])
  })
})
