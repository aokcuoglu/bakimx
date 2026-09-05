import { expect, test } from "bun:test"
import { MAX_FILE_SIZE_BYTES, validateUploadFile } from "@/lib/storage/types"

function makeFile(size: number, type = "image/jpeg", name = "a.jpg"): File {
  return new File([new Uint8Array(size)], name, { type })
}

test("izin verilen JPEG kabul edilir", () => {
  const result = validateUploadFile(makeFile(100_000))
  expect(result.valid).toBe(true)
  expect(result.error).toBeNull()
})

test("2 MB üstü reddedilir", () => {
  const result = validateUploadFile(makeFile(MAX_FILE_SIZE_BYTES + 1))
  expect(result.valid).toBe(false)
  expect(result.error).toContain("2 MB")
})

test("tam 2 MB kabul edilir", () => {
  const result = validateUploadFile(makeFile(MAX_FILE_SIZE_BYTES))
  expect(result.valid).toBe(true)
})

test("HEIC reddedilir", () => {
  const result = validateUploadFile(makeFile(10_000, "image/heic", "a.heic"))
  expect(result.valid).toBe(false)
  expect(result.error).toContain("HEIC")
})
