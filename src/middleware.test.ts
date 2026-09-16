import { describe, expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { config, middleware } from "./middleware"

describe("public landing routes", () => {
  test("keeps nested public illustrations outside the auth middleware", () => {
    const matcher = new RegExp(config.matcher[0])

    expect(matcher.test("/illustrations/demo-ocr-trial-complete.webp")).toBe(false)
    expect(matcher.test("/dashboard")).toBe(true)
  })

  test("allows anonymous local requests to /status", async () => {
    const response = await middleware(new NextRequest("http://localhost/status"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /oto-servis-programi", async () => {
    const response = await middleware(new NextRequest("http://localhost/oto-servis-programi"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /is-emri-programi", async () => {
    const response = await middleware(new NextRequest("http://localhost/is-emri-programi"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /contact-us", async () => {
    const response = await middleware(new NextRequest("http://localhost/contact-us"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /blog and blog posts", async () => {
    const index = await middleware(new NextRequest("http://localhost/blog"))
    expect(index.status).toBe(200)
    expect(index.headers.get("location")).toBeNull()

    const post = await middleware(
      new NextRequest("http://localhost/blog/oto-serviste-dijital-donusum"),
    )
    expect(post.status).toBe(200)
    expect(post.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /llms.txt", async () => {
    const response = await middleware(new NextRequest("http://localhost/llms.txt"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /rehber/arac-kabul-formu", async () => {
    const response = await middleware(new NextRequest("http://localhost/rehber/arac-kabul-formu"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to /kilavuz", async () => {
    const response = await middleware(new NextRequest("http://localhost/kilavuz"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("allows anonymous local requests to the comparison page", async () => {
    const response = await middleware(new NextRequest("http://localhost/karsilastir/defter-excel-oto-servis-programi"))
    expect(response.status).toBe(200)
  })

  test("allows anonymous customers to open a sales registration token", async () => {
    const response = await middleware(new NextRequest("http://localhost/register/sales/opaque-token"))

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  test("keeps sales registration tokens on the landing host in production", async () => {
    const response = await middleware(new NextRequest("https://app.bakimx.com/register/sales/opaque-token", {
      headers: { host: "app.bakimx.com" },
    }))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("https://bakimx.com/register/sales/opaque-token")
  })
})
