import { describe, expect, test } from "bun:test"
import { PARTS_REQUEST_STATUS } from "@/lib/constants"
import { partsRequestPillTone } from "./parts-request-pill"

describe("partsRequestPillTone", () => {
  test("her talep durumu için ton", () => {
    expect(partsRequestPillTone("requested")).toBe("warning")
    expect(partsRequestPillTone("prepared")).toBe("info")
    expect(partsRequestPillTone("delivered")).toBe("success")
    expect(partsRequestPillTone("cancelled")).toBe("destructive")
  })

  test("bilinmeyen durum nötr", () => {
    expect(partsRequestPillTone("whatever")).toBe("neutral")
  })

  test("PARTS_REQUEST_STATUS'taki hiçbir anahtar nötre düşmez", () => {
    for (const key of Object.keys(PARTS_REQUEST_STATUS)) {
      expect(partsRequestPillTone(key)).not.toBe("neutral")
    }
  })
})
