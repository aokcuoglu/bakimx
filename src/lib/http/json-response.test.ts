import { describe, expect, test } from "bun:test"
import { z } from "zod"
import { readJsonObject } from "./json-response"

const schema = z.object({ quote: z.object({ id: z.string() }) })

describe("readJsonObject", () => {
  test("returns a JSON object", async () => {
    await expect(readJsonObject(Response.json({ quote: { id: "opaque" } }), schema)).resolves.toEqual({ quote: { id: "opaque" } })
  })

  test.each([
    new Response("<html>upstream failure</html>", { status: 502, headers: { "content-type": "text/html" } }),
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
  ])("fails with a controlled message for malformed responses", async (response) => {
    await expect(readJsonObject(response, schema)).rejects.toThrow("Sunucudan geçersiz yanıt alındı")
  })

  test("fails with the same controlled message for a wrong JSON shape", async () => {
    await expect(readJsonObject(Response.json({ quote: {} }), schema)).rejects.toThrow("Sunucudan geçersiz yanıt alındı")
  })
})
