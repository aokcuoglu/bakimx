import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import type { NextRequest } from "next/server"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const publicPaths = ["/", "/login", "/register", "/privacy", "/terms"]
  const publicPrefixes = ["/s/"]

  if (publicPaths.includes(pathname)) {
    return NextResponse.next()
  }

  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/app")) {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json).*)"],
}