import { expect, test } from "bun:test"
import { formatWorkOrderNo, generateUniqueWorkOrderNo } from "@/lib/work-order-number"

test("formatWorkOrderNo açık workOrderNo varsa onu döner", () => {
  expect(formatWorkOrderNo({ workOrderNo: "BXABC123", id: "ckxyz" })).toBe("BXABC123")
})

test("formatWorkOrderNo null ise id'nin son 6 karakterinden BX- üretir", () => {
  // "clxxxxabcdef" -> son 6 -> "abcdef" -> "ABCDEF"
  expect(formatWorkOrderNo({ workOrderNo: null, id: "clxxxxabcdef" })).toBe("BX-ABCDEF")
})

test("generateUniqueWorkOrderNo dolu adayları atlayıp ilk boş olanı döner", async () => {
  let calls = 0
  const isTaken = async () => {
    calls++
    return calls < 3 // ilk iki aday dolu, üçüncü boş
  }
  const no = await generateUniqueWorkOrderNo(isTaken)
  expect(calls).toBe(3)
  expect(no.startsWith("BX")).toBe(true)
})
