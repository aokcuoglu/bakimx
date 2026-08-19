import { getIronSession } from "iron-session"
import { cookies } from "next/headers"
import { sessionOptions } from "@/lib/session"
import type { AdminSsoHandshake } from "@/lib/admin-sso"

/**
 * SSO el sıkışmasının (`state` / `nonce` / PKCE doğrulayıcı) tarayıcı tarafı.
 *
 * Neden ayrı çerez: oturum çerezine yazılamaz — el sıkışma henüz kimliği
 * doğrulanmamış bir ziyaretçiye ait ve tek kullanımlık. Neden iron-session:
 * içerik şifreli + imzalı olsun diye; düz bir çerezde `state` istemci
 * tarafından değiştirilebilir ve CSRF kontrolü anlamını yitirirdi.
 *
 * `sameSite: lax` (oturum çerezinden miras) Google'dan dönen üst düzey GET
 * yönlendirmesinde çerezin gönderilmesi için gereklidir.
 */

type HandshakeCookie = Partial<AdminSsoHandshake>

/** 10 dakika: kullanıcının Google ekranında geçireceği süreye göre bol, artığı yok. */
const HANDSHAKE_TTL_SECONDS = 600

function handshakeOptions() {
  return {
    password: sessionOptions.password,
    // Oturum çerezi gibi ortam başına ayrışır (app-dev ile prod aynı `.bakimx.com`
    // altında çakışmasın diye SESSION_COOKIE_NAME zaten ortama özel).
    cookieName: `${sessionOptions.cookieName}_oidc`,
    cookieOptions: { ...sessionOptions.cookieOptions, maxAge: HANDSHAKE_TTL_SECONDS },
  }
}

export async function saveHandshake(handshake: AdminSsoHandshake): Promise<void> {
  const cookieStore = await cookies()
  const session = await getIronSession<HandshakeCookie>(cookieStore, handshakeOptions())
  session.state = handshake.state
  session.nonce = handshake.nonce
  session.codeVerifier = handshake.codeVerifier
  session.redirectUri = handshake.redirectUri
  await session.save()
}

/**
 * El sıkışmayı okur ve HER DURUMDA siler — tek kullanımlık olması, yakalanan bir
 * `code`'un ikinci kez oynatılmasını engeller.
 */
export async function takeHandshake(): Promise<AdminSsoHandshake | null> {
  const cookieStore = await cookies()
  const session = await getIronSession<HandshakeCookie>(cookieStore, handshakeOptions())
  const { state, nonce, codeVerifier, redirectUri } = session
  session.destroy()
  if (!state || !nonce || !codeVerifier || !redirectUri) return null
  return { state, nonce, codeVerifier, redirectUri }
}
