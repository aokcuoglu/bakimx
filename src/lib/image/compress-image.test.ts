import { expect, test } from "bun:test"
import { fitDimensions } from "@/lib/image/fit-dimensions"
import { COMPRESS_MAX_EDGE, COMPRESS_TARGET_BYTES, MAX_FILE_SIZE_BYTES } from "@/lib/photos/limits"

// Canvas/DOM sıkıştırması tarayıcıda çalışır; burada saf boyut planı ve
// limit tutarlılığı doğrulanır.

test("2048 kenar planı 12 MP telefon karesini sığdırır", () => {
  expect(fitDimensions(4032, 3024, COMPRESS_MAX_EDGE)).toEqual({ w: 2048, h: 1536 })
})

test("hedef boyut hard limitin altında veya eşit", () => {
  expect(COMPRESS_TARGET_BYTES).toBeLessThanOrEqual(MAX_FILE_SIZE_BYTES)
})
