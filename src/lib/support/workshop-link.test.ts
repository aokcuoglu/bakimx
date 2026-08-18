import { expect, test } from "bun:test"

import { pickUniqueWorkshopId } from "./workshop-link"

test("tek aday bağlanır", () => {
  expect(pickUniqueWorkshopId(["w1"])).toBe("w1")
})

test("aynı atölyeyi gösteren iki kaynak tek adaydır", () => {
  expect(pickUniqueWorkshopId(["w1", "w1", null])).toBe("w1")
})

test("birden çok aday çıkarsa bağlanmaz", () => {
  expect(pickUniqueWorkshopId(["w1", "w2"])).toBeNull()
})

test("aday yoksa null döner", () => {
  expect(pickUniqueWorkshopId([])).toBeNull()
  expect(pickUniqueWorkshopId([null, undefined, ""])).toBeNull()
})
