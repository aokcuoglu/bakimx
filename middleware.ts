import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicPaths = ["/", "/login", "/register", "/forgot-password", "/privacy", "/terms"]
  const publicPrefixes = ["/s/", "/p/", "/api/auth", "/api/demo-request", "/api/support-request", "/api/cron"]

  if (publicPaths.includes(pathname)) {
    const session = await getSession()
    if (session?.userId && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/app", request.url))
    }
    return NextResponse.next()
  }

  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    const session = await getSession()
    const protectedApiPaths = [
      "/api/intakes", "/api/customers", "/api/vehicles", "/api/orders",
      "/api/workshop", "/api/photos", "/api/cashbox", "/api/parts",
      "/api/smart-capture", "/api/reminders", "/api/suppliers",
      "/api/technician", "/api/appointments", "/api/quotes", "/api/reports",
      "/api/advisor", "/api/communications", "/api/calendar",
    ]
    const isProtected = protectedApiPaths.some((p) => pathname.startsWith(p))
    if (isProtected && !session?.userId) {
      return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }
    return NextResponse.next()
  }

  if (pathname.startsWith("/app")) {
    const session = await getSession()
    if (!session?.userId) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json).*)"],
}