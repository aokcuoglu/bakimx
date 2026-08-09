import { NextResponse } from "next/server"
import { logoutAction } from "@/app/(auth)/login/actions"
import { sessionOptions } from "@/lib/session"
import {
  AUTH_BOUNCE_COOKIE,
  LOGOUT_REASON_PARAM,
  SESSION_INVALID_REASON,
} from "@/lib/session-recovery"

/**
 * Destek kaçış kapısı — TIKLANABİLİR çıkış.
 *
 * Bir kullanıcı herhangi bir sebeple kilitli kaldığında ("çerezlerinizi silin"
 * bir destek cevabı değildir) bu adres tek tıkla oturumu temizler. GET olduğu
 * için telefonda linke basmak yeterli; POST formu gerekmez.
 *
 * Çerezi doğrudan yanıtta siliyoruz — logoutAction() bir Server Action olarak
 * redirect fırlatır ve o yolda Set-Cookie garanti değildir. Burada tek iş var:
 * çerezler gitsin, kullanıcı giriş formunu görsün.
 */
export async function GET(request: Request) {
  const loginUrl = new URL("/login", request.url)
  loginUrl.searchParams.set(LOGOUT_REASON_PARAM, SESSION_INVALID_REASON)

  const response = NextResponse.redirect(loginUrl)
  response.cookies.set(sessionOptions.cookieName, "", {
    ...sessionOptions.cookieOptions,
    maxAge: 0,
  })
  response.cookies.set(AUTH_BOUNCE_COOKIE, "", { path: "/", maxAge: 0 })
  return response
}

export async function POST() {
  try {
    await logoutAction()
  } catch {
    // logoutAction redirects, which throws in API route
  }
  return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"))
}