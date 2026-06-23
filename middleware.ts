import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { NextRequest } from "next/server"

// Two subdomains, one container (nginx preserves Host):
//   bakimx.com      = landing + auth + public token pages + /api
//   app.bakimx.com  = the authenticated app (clean URLs, no /app prefix)
const APP_ORIGIN = "https://app.bakimx.com"
const LANDING_ORIGIN = "https://bakimx.com"

// Pages served on the landing host. Everything else is app surface.
const PUBLIC_EXACT = new Set(["/", "/login", "/forgot-password", "/register", "/privacy", "/terms"])
const PUBLIC_PREFIX = ["/s/", "/p/", "/invite/", "/demo"]

// API auth (host-agnostic — same container serves both hosts).
const PUBLIC_API_PREFIX = ["/api/auth", "/api/demo-request", "/api/support-request", "/api/cron"]
const PROTECTED_API_PREFIX = [
  "/api/intakes", "/api/customers", "/api/vehicles", "/api/orders",
  "/api/workshop", "/api/photos", "/api/cashbox", "/api/parts",
  "/api/smart-capture", "/api/reminders", "/api/suppliers",
  "/api/technician", "/api/appointments", "/api/quotes", "/api/reports",
  "/api/advisor", "/api/communications", "/api/calendar",
]

function isPublicPage(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase()
  const isLocal =
    host === "" || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")

  // ---- API: host-agnostic ----
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIX.some((p) => pathname.startsWith(p))) return NextResponse.next()
    if (PROTECTED_API_PREFIX.some((p) => pathname.startsWith(p))) {
      const session = await getSession()
      if (!session?.userId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // ---- LOCAL DEV: single host, path-based auth (clean URLs, no host split) ----
  if (isLocal) {
    if (isPublicPage(pathname)) {
      if (pathname === "/login") {
        const session = await getSession()
        if (session?.userId) return NextResponse.redirect(new URL("/dashboard", request.url))
      }
      return NextResponse.next()
    }
    const session = await getSession()
    if (!session?.userId) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  // ---- PROD: host-aware ----
  if (host === "www.bakimx.com") {
    return NextResponse.redirect(`${LANDING_ORIGIN}${pathname}${search}`, 301)
  }

  // Legacy /app/* → clean URLs on the app host (works from either host)
  if (pathname === "/app") return NextResponse.redirect(`${APP_ORIGIN}/dashboard`, 301)
  if (pathname.startsWith("/app/")) {
    return NextResponse.redirect(`${APP_ORIGIN}${pathname.slice(4)}${search}`, 301)
  }

  // ---- APP HOST (app.bakimx.com) ----
  if (host === "app.bakimx.com") {
    if (pathname === "/") return NextResponse.redirect(`${APP_ORIGIN}/dashboard`)
    // landing / auth / public-token pages belong on the landing host
    if (isPublicPage(pathname)) {
      return NextResponse.redirect(`${LANDING_ORIGIN}${pathname}${search}`)
    }
    // real app route → require auth (login lives on the landing host)
    const session = await getSession()
    if (!session?.userId) {
      const target = encodeURIComponent(`${APP_ORIGIN}${pathname}${search}`)
      return NextResponse.redirect(`${LANDING_ORIGIN}/login?redirect=${target}`)
    }
    return NextResponse.next()
  }

  // ---- LANDING HOST (bakimx.com) + unknown hosts ----
  if (isPublicPage(pathname)) {
    if (pathname === "/login") {
      const session = await getSession()
      if (session?.userId) return NextResponse.redirect(`${APP_ORIGIN}/dashboard`)
    }
    return NextResponse.next()
  }
  // app path requested on the landing host → move it to the app host
  return NextResponse.redirect(`${APP_ORIGIN}${pathname}${search}`, 301)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json).*)"],
}
