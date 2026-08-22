import { describe, expect, mock, test } from "bun:test"
import { NextRequest } from "next/server"
import type { SessionData } from "@/lib/session"

let currentSession: SessionData = {}

mock.module("@/lib/session", () => ({
  getSession: async () => currentSession,
  sessionOptions: {
    cookieName: "bakimx_session",
    cookieOptions: { path: "/", httpOnly: true, sameSite: "lax" },
  },
}))

const { middleware } = await import("./middleware")

describe("authenticated app home", () => {
  test("redirects technician roles from the app-dev root to /technician", async () => {
    currentSession = {
      userId: "technician-user",
      role: "usta",
    }
    const response = await middleware(new NextRequest("https://app-dev.bakimx.com/"))

    expect(response.headers.get("location")).toBe("https://app-dev.bakimx.com/technician")
  })

  test("redirects management roles from the app-dev root to /dashboard", async () => {
    currentSession = {
      userId: "owner-user",
      role: "owner",
    }
    const response = await middleware(new NextRequest("https://app-dev.bakimx.com/"))

    expect(response.headers.get("location")).toBe("https://app-dev.bakimx.com/dashboard")
  })
})

describe("public landing routes", () => {
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

  test("allows anonymous local requests to the comparison page", async () => {
    const response = await middleware(new NextRequest("http://localhost/karsilastir/defter-excel-oto-servis-programi"))
    expect(response.status).toBe(200)
  })
})
