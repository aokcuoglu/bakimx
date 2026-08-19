import { describe, expect, test } from "bun:test"
import { MAX_INLINE_ROW_ACTIONS, splitRowActions, type SplittableRowAction } from "@/lib/orders/row-actions"

const a = (key: string, tone: SplittableRowAction["tone"] = "default") => ({ key, tone })

describe("splitRowActions", () => {
  test("iki ve altı aksiyon satırda kalır, menü açılmaz", () => {
    expect(splitRowActions([a("detail"), a("delete", "danger")])).toEqual({
      inline: [a("detail"), a("delete", "danger")],
      overflow: [],
    })
    expect(splitRowActions([a("delete", "danger")])).toEqual({
      inline: [a("delete", "danger")],
      overflow: [],
    })
    expect(splitRowActions([])).toEqual({ inline: [], overflow: [] })
  })

  test("ikiyi geçince satırda yalnız yıkıcı aksiyon kalır, kalanı menüye iner", () => {
    const { inline, overflow } = splitRowActions([
      a("detail"),
      a("price"),
      a("purchase"),
      a("delete", "danger"),
    ])
    expect(inline).toEqual([a("delete", "danger")])
    expect(overflow).toEqual([a("detail"), a("price"), a("purchase")])
  })

  test("yıkıcı aksiyon yoksa (kilitli emir) ilk aksiyon satırda kalır", () => {
    const { inline, overflow } = splitRowActions([a("detail"), a("price"), a("purchase")])
    expect(inline).toEqual([a("detail")])
    expect(overflow).toEqual([a("price"), a("purchase")])
  })

  test("satırda gösterilen ikon sayısı hiçbir zaman 2'yi geçmez", () => {
    for (let n = 0; n <= 6; n++) {
      const actions = Array.from({ length: n }, (_, i) => a(`k${i}`, i === n - 1 ? "danger" : "default"))
      const { inline, overflow } = splitRowActions(actions)
      // Taşma varsa ⋯ tetikleyicisi de bir ikon yeri kaplar → inline en çok 1.
      expect(inline.length + (overflow.length > 0 ? 1 : 0)).toBeLessThanOrEqual(MAX_INLINE_ROW_ACTIONS)
      expect([...inline, ...overflow].map((x) => x.key).sort()).toEqual(actions.map((x) => x.key).sort())
    }
  })
})
