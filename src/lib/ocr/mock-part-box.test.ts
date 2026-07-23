import { test, expect } from "bun:test"
import { getMockOcrProvider } from "./mock-ocr-provider"

test("MockOcrProvider.extractPartBox: deterministik SETA verisi döner", async () => {
  const provider = getMockOcrProvider()
  const result = await provider.extractPartBox(Buffer.from("x"), "image/jpeg")
  expect(result.provider).toBe("mock")
  expect(result.partName.value).toBe("Yağ filtresi")
  expect(result.brand.value).toBe("SETA")
  expect(result.partNumbers.map((p) => p.value)).toEqual(["STO-539", "04152-YZZA6", "HU 6006 Z"])
})
