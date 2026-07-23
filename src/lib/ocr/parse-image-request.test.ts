import { test, expect } from "bun:test"
import { NextResponse } from "next/server"
import { parseOcrImageRequest } from "./parse-image-request"

test("parseOcrImageRequest: multipart 'image' → buffer + mimeType", async () => {
  const fd = new FormData()
  fd.set("image", new File([Buffer.from("hello")], "box.jpg", { type: "image/jpeg" }))
  const req = new Request("http://x/api", { method: "POST", body: fd })
  const out = await parseOcrImageRequest(req)
  expect(out instanceof NextResponse).toBe(false)
  if (out instanceof NextResponse) throw new Error("beklenmedik NextResponse")
  expect(out.mimeType).toBe("image/jpeg")
  expect(out.imageBuffer.toString()).toBe("hello")
})

test("parseOcrImageRequest: JSON data URL → buffer + mimeType", async () => {
  const b64 = Buffer.from("world").toString("base64")
  const req = new Request("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageDataUrl: `data:image/png;base64,${b64}`, mimeType: "image/png" }),
  })
  const out = await parseOcrImageRequest(req)
  if (out instanceof NextResponse) throw new Error("beklenmedik NextResponse")
  expect(out.mimeType).toBe("image/png")
  expect(out.imageBuffer.toString()).toBe("world")
})

test("parseOcrImageRequest: multipart 'image' eksikse 400", async () => {
  const req = new Request("http://x/api", { method: "POST", body: new FormData() })
  const out = await parseOcrImageRequest(req)
  expect(out instanceof NextResponse).toBe(true)
  if (out instanceof NextResponse) expect(out.status).toBe(400)
})

test("parseOcrImageRequest: desteklenmeyen MIME → 400", async () => {
  const req = new Request("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageDataUrl: "data:image/gif;base64,AAAA", mimeType: "image/gif" }),
  })
  const out = await parseOcrImageRequest(req)
  if (!(out instanceof NextResponse)) throw new Error("NextResponse bekleniyordu")
  expect(out.status).toBe(400)
})
