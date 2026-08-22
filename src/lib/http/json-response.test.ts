import { describe, expect, test } from "bun:test"
import { readJsonObject } from "./json-response"

describe("readJsonObject", () => {
  test("returns a JSON object", async () => {
    await expect(readJsonObject(Response.json({ quote: { id: "opaque" } }))).resolves.toEqual({ quote: { id: "opaque" } })
  })

  test.each([
    new Response("<html>upstream failure</html>", { status: 502, headers: { "content-type": "text/html" } }),
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
  ])("fails with a controlled message for malformed responses", async (response) => {
    await expect(readJsonObject(response)).rejects.toThrow("Sunucudan geçersiz yanıt alındı")
  })
})
