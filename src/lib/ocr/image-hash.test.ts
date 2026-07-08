import { test, expect } from "bun:test"
import { hashImageBuffer } from "./image-hash"

test("hashImageBuffer: bilinen SHA-256 vektörü (lowercase hex)", () => {
  // echo -n "abc" | sha256sum
  const digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
  expect(hashImageBuffer(Buffer.from("abc"))).toBe(digest)
})

test("hashImageBuffer: aynı byte'lar → aynı hash (deterministik)", () => {
  const a = Buffer.from([0x01, 0x02, 0x03, 0xff])
  const b = Buffer.from([0x01, 0x02, 0x03, 0xff])
  expect(hashImageBuffer(a)).toBe(hashImageBuffer(b))
})

test("hashImageBuffer: farklı byte'lar → farklı hash", () => {
  expect(hashImageBuffer(Buffer.from("abc"))).not.toBe(hashImageBuffer(Buffer.from("abd")))
})

test("hashImageBuffer: 64 karakter hex döndürür", () => {
  expect(hashImageBuffer(Buffer.from("anything"))).toMatch(/^[0-9a-f]{64}$/)
})
