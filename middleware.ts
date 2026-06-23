import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Self-serve signup is an approval-gated trial application: /register creates a
  // workshop in `pending` status that cannot sign in until an admin approves it
  // (no instant provisioning). /register is public via the fall-through below;
  // the page redirects already-authenticated users to /app. The registration
  // POST is public through the "/api/auth" prefix.
  const publicPaths = ["/", "/login", "/forgot-password", "/privacy", "/terms"]
  const publicPrefixes = ["/s/", "/p/", "/api/auth", "/api/demo-request", "/api/support-request", "/api/cron"]

  if (publicPaths.includes(pathname)) {
    const session = await getSession()
    if (session?.userId && pathname === "/login") {
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

  if (pathname.startsWith("/app") || pathname.startsWith("/admin")) {
    const session = await getSession()
    if (!session?.userId) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    // /admin additionally requires an allow-listed e-mail; the page enforces
    // that (404 for non-admins) — middleware can't reach the DB on the edge.
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json).*)"],
}