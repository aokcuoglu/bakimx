import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { middleware } from "./middleware"

describe("public status route", () => {
  test("allows anonymous local requests to /status", async () => {
    const response = await middleware(new NextRequest("http://localhost/status"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })
})
