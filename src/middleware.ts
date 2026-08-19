import { NextResponse } from "next/server"
import { getSession, sessionOptions } from "@/lib/session"
import {
  AUTH_BOUNCE_COOKIE,
  AUTH_BOUNCE_TTL_SECONDS,
  isBounceLimitReached,
  LOGOUT_REASON_PARAM,
  nextBounceCount,
  SESSION_LOOP_REASON,
  shouldClearSessionOnLogin,
} from "@/lib/session-recovery"
import { isTechnicianRestrictedRole, isRouteAllowedForTechnician } from "@/lib/technician-route-access"
import type { NextRequest } from "next/server"

// Two subdomains, one container (nginx preserves Host):
//   bakimx.com      = landing + auth + public token pages + /api
//   app.bakimx.com  = the authenticated app (clean URLs, no /app prefix)
const APP_ORIGIN = "https://app.bakimx.com"
const LANDING_ORIGIN = "https://bakimx.com"

// Pages served on the landing host. Everything else is app surface.
// /admin-login: platform personelinin Google SSO kapısı (BAK-94). Oturum
// AÇMADAN erişilebilmesi gerekir, yani public; konsolun kendisi (`/admin`)
// yönetici olmayana 404 vermeye devam eder.
const PUBLIC_EXACT = new Set(["/", "/login", "/admin-login", "/forgot-password", "/register", "/privacy", "/terms", "/kvkk", "/acik-riza", "/fiyatlar"])
// /payment/result: TAMI 3DS/callback tarayıcıyı oturumsuz (public checkout) da
// buraya 303'ler; sonuç DB'den okunur, tenant sızıntısı yok (bkz. result/page.tsx).
// /w/<kod>: İş yeri özel giriş ekranı (BAK-38) — e-postasız kullanıcı için tenant seçimi.
// /destek/<token>: canlı destek "sohbete dön" bağlantısı (BAK-99) — e-postadaki
// bağlantı oturumsuz bir tarayıcıda açılır, auth kapısına takılırsa asla açılmaz.
const PUBLIC_PREFIX = ["/s/", "/p/", "/w/", "/invite/", "/demo", "/satin-al", "/payment", "/reset-password/", "/destek/"]

// API auth (host-agnostic — same container serves both hosts).
const PUBLIC_API_PREFIX = ["/api/auth", "/api/checkout", "/api/demo-request", "/api/support-request", "/api/cron"]
const PROTECTED_API_PREFIX = [
  "/api/intakes", "/api/customers", "/api/vehicles", "/api/orders",
  "/api/workshop", "/api/photos", "/api/cashbox", "/api/parts",
  "/api/smart-capture", "/api/reminders", "/api/suppliers",
  "/api/technician", "/api/appointments", "/api/quotes", "/api/reports",
  "/api/advisor", "/api/billing", "/api/communications", "/api/calendar",
  "/api/catalog",
]

function isPublicPage(pathname: string): boolean {
  return PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
}

/**
 * Zorla çıkış sinyali. (app)/layout.tsx, oturumu artık geçerli olmayan bir
 * kullanıcıyı `/login?expired=<lockReason>` (plan kilidi) veya
 * `/login?reason=session_invalid` (çerez geçerli ama karşılığı yok) ile buraya
 * yollar; oturum cookie'sini burada siliyoruz çünkü bir Server Component cookie
 * yazamaz. Middleware hem tam sayfa hem RSC (soft navigation) isteklerinde
 * çalıştığı için tek güvenilir nokta.
 *
 * Cookie temizlenmezse /login → (oturum görülür) → /dashboard → (layout reddeder)
 * → /login sonsuz döngüsü oluşur; bu yüzden sinyal varken oturumlu kullanıcıyı
 * /dashboard'a geri YOLLAMIYORUZ.
 */
function isForcedLogout(request: NextRequest): boolean {
  return shouldClearSessionOnLogin(request.nextUrl.searchParams)
}

function clearSession(response: NextResponse): NextResponse {
  response.cookies.set(sessionOptions.cookieName, "", {
    ...sessionOptions.cookieOptions,
    maxAge: 0,
  })
  response.cookies.set(AUTH_BOUNCE_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}

/**
 * Son savunma hattı: /login ↔ /dashboard sekmelerini sayar.
 *
 * Yukarıdaki açık sinyal bilinen kök nedeni kapatır. Bu sayaç ise BİLİNMEYEN bir
 * neden (ileride eklenen bir kapı, beklenmedik bir veri durumu) yüzünden oluşan
 * döngüde kullanıcının kilitlenmesini engeller: limitte oturum imha edilir ve
 * giriş formu gösterilir. Sağlıklı kullanımda sayaç 1'i geçmez ve
 * AUTH_BOUNCE_TTL_SECONDS içinde kendiliğinden düşer.
 */
function guardBounce(request: NextRequest, redirectTo: string | URL): NextResponse {
  const raw = request.cookies.get(AUTH_BOUNCE_COOKIE)?.value

  if (isBounceLimitReached(raw)) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set(LOGOUT_REASON_PARAM, SESSION_LOOP_REASON)
    return clearSession(NextResponse.redirect(loginUrl))
  }

  const response = NextResponse.redirect(redirectTo)
  response.cookies.set(AUTH_BOUNCE_COOKIE, String(nextBounceCount(raw)), {
    path: "/",
    maxAge: AUTH_BOUNCE_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  return response
}

/** Sayfa gerçekten servis edildiyse döngü yok — sayacı temizle. */
function clearBounceIfPresent(request: NextRequest, response: NextResponse): NextResponse {
  if (request.cookies.has(AUTH_BOUNCE_COOKIE)) {
    response.cookies.set(AUTH_BOUNCE_COOKIE, "", { path: "/", maxAge: 0 })
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase()
  const isLocal =
    host === "" || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")
  // The AWS-hosted dev env (app-dev.bakimx.com) serves the whole app on a single host (like
  // local dev) — no bakimx.com / app.bakimx.com split, so app routes don't bounce to prod.
  const isSingleHost = isLocal || host === "app-dev.bakimx.com"

  // ---- API: host-agnostic ----
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIX.some((p) => pathname.startsWith(p))) return NextResponse.next()
    if (PROTECTED_API_PREFIX.some((p) => pathname.startsWith(p))) {
      const session = await getSession()
      if (!session?.userId) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // ---- SINGLE-HOST (local dev + app-dev): path-based auth, clean URLs, no host split ----
  if (isSingleHost) {
    if (isPublicPage(pathname)) {
      if (pathname === "/login") {
        const session = await getSession()
        if (session?.userId) {
          if (isForcedLogout(request)) return clearSession(NextResponse.next())
          const loginTarget = isTechnicianRestrictedRole(session.role) ? "/technician" : "/dashboard"
          return guardBounce(request, new URL(loginTarget, request.url))
        }
      }
      return clearBounceIfPresent(request, NextResponse.next())
    }
    const session = await getSession()
    if (!session?.userId) {
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(loginUrl)
    }
    // BAK-106: usta/cirak/staff deny-by-default — izin listesi dışı /technician'a yönlenir.
    if (isTechnicianRestrictedRole(session.role) && !isRouteAllowedForTechnician(pathname)) {
      return NextResponse.redirect(new URL("/technician", request.url))
    }
    return clearBounceIfPresent(request, NextResponse.next())
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
    if (pathname === "/") {
      const session = await getSession()
      if (session?.userId) {
        const homeTarget = isTechnicianRestrictedRole(session.role) ? "/technician" : "/dashboard"
        return NextResponse.redirect(`${APP_ORIGIN}${homeTarget}`)
      }
      return NextResponse.redirect(`${APP_ORIGIN}/dashboard`)
    }
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
    // BAK-106: usta/cirak/staff deny-by-default
    if (isTechnicianRestrictedRole(session.role) && !isRouteAllowedForTechnician(pathname)) {
      return NextResponse.redirect(`${APP_ORIGIN}/technician`)
    }
    return clearBounceIfPresent(request, NextResponse.next())
  }

  // ---- LANDING HOST (bakimx.com) + unknown hosts ----
  if (isPublicPage(pathname)) {
    if (pathname === "/login") {
      const session = await getSession()
      if (session?.userId) {
        if (isForcedLogout(request)) return clearSession(NextResponse.next())
        const loginTarget = isTechnicianRestrictedRole(session.role) ? "/technician" : "/dashboard"
        return guardBounce(request, `${APP_ORIGIN}${loginTarget}`)
      }
    }
    return clearBounceIfPresent(request, NextResponse.next())
  }
  // app path requested on the landing host → move it to the app host
  return NextResponse.redirect(`${APP_ORIGIN}${pathname}${search}`, 301)
}

export const config = {
  // Statik public asset'leri (özellikle BrandLogo'nun 01..04-bakimx-* logo
  // variant'ları) middleware'den muaf tut. Aksi halde kök görsel istekleri
  // auth-gate edilip /login'e 307'lenir; bu yüzden app-dev/prod'da (next
  // start/standalone, dev'in aksine, middleware'i public static'lerde de
  // çalıştırır) logolar kayboluyordu — hem doğrudan erişimde hem next/image'in
  // kaynak fetch'inde. Ayrıca transactional e-postaların logosu (02-bakimx-
  // primary-dark.png) anonim çekildiği için kök PNG'ler de PUBLIC olmalı.
  // Kökteki tüm görsel dosyaları (svg/png/jpg/jpeg/webp/gif/ico) ve landing
  // marketing asset'leri (/landing/**) hariç bırakılır.
  //
  // /sw.js (BAK-129): service worker kökten servis edilmeli — auth kapısına
  // takılırsa /login'e 307'lenir, tarayıcı JavaScript yerine HTML alır ve
  // kayıt "unsupported MIME type" ile düşer. İçeriğinde kiracıya ait hiçbir
  // veri yok; payload'ı push mesajı taşır.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|landing/|[^/]+\\.(?:svg|png|jpe?g|webp|gif|ico)$).*)"],
}
