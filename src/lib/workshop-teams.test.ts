import { describe, expect, test } from "bun:test"
import { actorCan, parsePermissions } from "@/lib/roles"

describe("ekip izinleri", () => {
  test("sahip ekip listesinden bağımsız tam yetkilidir", () => {
    expect(actorCan({ role: "owner", teamPermissions: [] }, "billing.manage")).toBe(true)
  })

  test("ekip atanmış üyede kutu listesi geçerlidir", () => {
    expect(
      actorCan({ role: "cirak", teamPermissions: ["order.edit"] }, "order.edit"),
    ).toBe(true)
    expect(
      actorCan({ role: "usta", teamPermissions: ["order.edit"] }, "parts.purchase"),
    ).toBe(false)
  })

  test("ekip yoksa statik rol matrisi durur", () => {
    expect(actorCan({ role: "cirak", teamPermissions: null }, "parts.purchase")).toBe(true)
    expect(actorCan({ role: "cirak", teamPermissions: null }, "order.edit")).toBe(false)
  })

  test("bilinmeyen anahtarlar yok sayılır", () => {
    expect(parsePermissions(["order.edit", "nope"])).toEqual(["order.edit"])
  })
})
