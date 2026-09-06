import { expect, test } from "bun:test"
import {
  COMPRESS_JPEG_QUALITY,
  COMPRESS_MAX_EDGE,
  COMPRESS_TARGET_BYTES,
  MAX_ACTIVE_PHOTOS_PER_INTAKE,
  MAX_BATCH_PHOTOS,
  MAX_FILE_SIZE_BYTES,
  MAX_RAW_INPUT_BYTES,
  maxFileSizeLabelMb,
} from "@/lib/photos/limits"
import { MAX_BATCH_PHOTOS as SELECT_BATCH } from "@/lib/photos/select-photo-files"
import { MAX_FILE_SIZE_BYTES as STORAGE_MAX } from "@/lib/storage/types"

test("sunucu hard limiti 2 MB", () => {
  expect(MAX_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024)
  expect(STORAGE_MAX).toBe(MAX_FILE_SIZE_BYTES)
  expect(maxFileSizeLabelMb()).toBe("2")
})

test("tek seçim kuyruğu 3", () => {
  expect(MAX_BATCH_PHOTOS).toBe(3)
  expect(SELECT_BATCH).toBe(3)
})

test("iş emri aktif foto kotası 30", () => {
  expect(MAX_ACTIVE_PHOTOS_PER_INTAKE).toBe(30)
})

test("sıkıştırma profili kanıt için makul", () => {
  expect(COMPRESS_MAX_EDGE).toBe(2048)
  expect(COMPRESS_JPEG_QUALITY).toBe(0.8)
  expect(COMPRESS_TARGET_BYTES).toBe(1 * 1024 * 1024)
  expect(MAX_RAW_INPUT_BYTES).toBe(20 * 1024 * 1024)
  expect(COMPRESS_TARGET_BYTES).toBeLessThanOrEqual(MAX_FILE_SIZE_BYTES)
})
