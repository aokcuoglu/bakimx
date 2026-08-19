import { createRemoteJWKSet, jwtVerify } from "jose"
import { resolveAdminMembership } from "@/lib/admin-membership"
import { prisma } from "@/lib/db"

/**
 * `/admin` için Google Workspace SSO (OIDC) — BAK-94.
 *
 * Kapsam SADECE platform konsoludur. Atölye kullanıcıları e-posta/şifre ile
 * girmeye devam eder; `/login` bu dosyadan etkilenmez.
 *
 * Üç kural bu modülün varlık sebebi:
 *
 * 1. **Otomatik hesap açma YOK.** Google yalnız kimliği doğrular, yetkiyi DB
 *    verir. `PlatformAdmin` satırı olmayan bir `bakimx.com` hesabı, Google
 *    girişi başarılı olsa bile konsola giremez ve kendine kayıt yaratamaz
 *    (`resolveSsoAdmin`). Tek istisna, şifreli yolla ortak olan `ADMIN_EMAILS`
 *    bootstrap'ıdır: tablo BOŞKEN listedeki adres girebilir ve satırı yazılır
 *    (BAK-114) — listede olmayan bir adres o durumda da giremez.
 * 2. **`hd` SUNUCUDA doğrulanır.** Yetkilendirme isteğine `hd=bakimx.com`
 *    eklemek bir filtre değil, yalnız hesap seçicideki ipucudur — kişisel Gmail
 *    ile gelmeyi engellemez. Karar `verifyGoogleIdToken` içindeki kimlik
 *    jetonu kontrolüyle verilir.
 * 3. **Yapılandırma eksikse yol KAPALI.** `getAdminSsoConfig()` null dönerse
 *    başlatma/callback 404'tür ve durum loglanır; sessizce şifre girişine
 *    düşmez.
 *
 * Oturum ikinci bir mekanizma değildir: doğrulama bitince mevcut
 * `establishSession()` çağrılır, böylece BAK-93'ün `PlatformAdmin.sessionsValidFrom`
 * iptali SSO oturumlarında da olduğu gibi işler.
 */

// Google'ın OIDC uçları sabittir ve dokümante edilmiştir; discovery dokümanını
// her istekte çekmek yerine sabit tutuluyor (bir ağ çağrısı ve bir hata modu az).
// https://developers.google.com/identity/openid-connect/openid-connect
const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
/** Google kimlik jetonlarını tarihsel olarak iki `iss` değerinden biriyle imzalar. */
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

/** Google Cloud'da kayıtlı olması gereken yol — üç ortam için de birebir bu. */
export const ADMIN_SSO_CALLBACK_PATH = "/api/auth/admin/google/callback"
/** SSO giriş ekranı (`/login` değişmiyor, yöneticiler için ayrı kapı). */
export const ADMIN_LOGIN_PATH = "/admin-login"

/** Prod'da konsol app host'unda yaşar; landing host'undan gelen istek oraya kanonikleştirilir. */
const PROD_LANDING_HOSTS = new Set(["bakimx.com", "www.bakimx.com"])
const PROD_APP_HOST = "app.bakimx.com"

export interface AdminSsoConfig {
  clientId: string
  clientSecret: string
  /** Kabul edilen Workspace alan adı — kimlik jetonundaki `hd` bununla karşılaştırılır. */
  allowedDomain: string
}

/**
 * Yapılandırma, ya da eksikse null. Client ID/secret `.env` / SSM üzerinden
 * gelir; repoda değer tutulmaz.
 */
export function getAdminSsoConfig(): AdminSsoConfig | null {
  const clientId = (process.env.GOOGLE_OIDC_CLIENT_ID || "").trim()
  const clientSecret = (process.env.GOOGLE_OIDC_CLIENT_SECRET || "").trim()
  const allowedDomain = (process.env.GOOGLE_OIDC_HD || "bakimx.com").trim().toLowerCase()
  if (!clientId || !clientSecret || !allowedDomain) return null
  return { clientId, clientSecret, allowedDomain }
}

/** Yapılandırma eksikken çağrılan her yol bunu loglar — sessiz düşüş olmasın. */
export function logAdminSsoDisabled(where: string): void {
  console.warn(
    `[admin-sso] ${where}: GOOGLE_OIDC_CLIENT_ID/GOOGLE_OIDC_CLIENT_SECRET tanımsız — Google SSO yolu kapalı.`
  )
}

/**
 * Reddetme sebepleri. Kullanıcıya jenerik mesaj gösterilir (bkz. `/admin-login`);
 * ayrım denetim kaydı ve sunucu logu içindir.
 */
export type AdminSsoRejection =
  | "provider_error"
  | "invalid_request"
  | "invalid_state"
  | "token_exchange_failed"
  | "invalid_token"
  | "nonce_mismatch"
  | "email_unverified"
  | "domain_not_allowed"
  | "no_admin_account"

export interface AdminSsoHandshake {
  state: string
  nonce: string
  codeVerifier: string
  /** Authorize isteğinde kullanılan değer; token değişiminde AYNISI gönderilmeli. */
  redirectUri: string
}

function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return base64Url(buf)
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url")
}

/** PKCE S256 challenge — `code_verifier`'ın SHA-256'sının base64url'ü. */
export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export function createHandshake(redirectUri: string): AdminSsoHandshake {
  return {
    state: randomToken(),
    nonce: randomToken(),
    codeVerifier: randomToken(48),
    redirectUri,
  }
}

/**
 * Callback adresi. Google'da kayıtlı URI ile BİREBİR eşleşmek zorunda olduğu
 * için host'tan türetilir; prod'da landing host'undan gelen istek app host'una
 * kanonikleştirilir (konsol orada yaşıyor ve yalnız o URI kayıtlı).
 *
 * `GOOGLE_OIDC_REDIRECT_URI` verilmişse o kazanır — beklenmedik bir proxy/host
 * kurulumunda kaçış kapısı.
 */
export function resolveRedirectUri(request: Request): string {
  const explicit = (process.env.GOOGLE_OIDC_REDIRECT_URI || "").trim()
  if (explicit) return explicit

  const rawHost = (request.headers.get("host") || new URL(request.url).host).toLowerCase()
  const host = PROD_LANDING_HOSTS.has(rawHost.split(":")[0]) ? PROD_APP_HOST : rawHost
  const hostname = host.split(":")[0]
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")
  return `${isLocal ? "http" : "https"}://${host}${ADMIN_SSO_CALLBACK_PATH}`
}

export function buildAuthorizationUrl(
  config: AdminSsoConfig,
  handshake: AdminSsoHandshake,
  challenge: string
): string {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", handshake.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid email profile")
  url.searchParams.set("state", handshake.state)
  url.searchParams.set("nonce", handshake.nonce)
  url.searchParams.set("code_challenge", challenge)
  url.searchParams.set("code_challenge_method", "S256")
  // Filtre DEĞİL, yalnız hesap seçicideki ipucu — gerçek kapı `verifyGoogleIdToken`.
  url.searchParams.set("hd", config.allowedDomain)
  url.searchParams.set("prompt", "select_account")
  return url.toString()
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null
function googleJwks() {
  cachedJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL))
  return cachedJwks
}

/** `jwtVerify`'ın anahtar parametresi; testler yerel bir açık anahtar enjekte eder. */
type VerificationKey = Parameters<typeof jwtVerify>[1]

export interface GoogleIdentity {
  email: string
  hd: string
  subject: string
}

export type AdminSsoResult<T> = { ok: true; value: T } | { ok: false; reason: AdminSsoRejection; detail?: string }

/**
 * Kimlik jetonunun SUNUCU tarafı doğrulaması: JWKS imzası, `iss`/`aud`/`exp`,
 * `nonce`, `email_verified` ve `hd`. Bunlardan biri düşerse oturum açılmaz.
 */
export async function verifyGoogleIdToken(params: {
  idToken: string
  clientId: string
  allowedDomain: string
  expectedNonce: string
  key?: VerificationKey
}): Promise<AdminSsoResult<GoogleIdentity>> {
  let payload: Record<string, unknown>
  try {
    const verified = await jwtVerify(params.idToken, params.key ?? googleJwks(), {
      issuer: GOOGLE_ISSUERS,
      audience: params.clientId,
      requiredClaims: ["exp", "iat", "sub", "email"],
    })
    payload = verified.payload as Record<string, unknown>
  } catch (err) {
    return { ok: false, reason: "invalid_token", detail: err instanceof Error ? err.message : String(err) }
  }

  if (typeof payload.nonce !== "string" || payload.nonce !== params.expectedNonce) {
    return { ok: false, reason: "nonce_mismatch" }
  }
  if (payload.email_verified !== true) {
    return { ok: false, reason: "email_unverified" }
  }

  const hd = typeof payload.hd === "string" ? payload.hd.trim().toLowerCase() : ""
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : ""
  // `hd` VE e-posta alan adı birlikte kontrol edilir: `hd` doğru olsa bile
  // e-posta başka bir alan adındaysa (alias) kabul etmiyoruz.
  if (!hd || hd !== params.allowedDomain || !email.endsWith(`@${params.allowedDomain}`)) {
    return { ok: false, reason: "domain_not_allowed" }
  }

  return { ok: true, value: { email, hd, subject: String(payload.sub) } }
}

/** Yetkilendirme kodunu kimlik jetonuyla takas eder (PKCE `code_verifier` ile). */
export async function exchangeCodeForIdToken(params: {
  code: string
  handshake: AdminSsoHandshake
  config: AdminSsoConfig
}): Promise<AdminSsoResult<string>> {
  let response: Response
  try {
    response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: params.code,
        client_id: params.config.clientId,
        client_secret: params.config.clientSecret,
        redirect_uri: params.handshake.redirectUri,
        grant_type: "authorization_code",
        code_verifier: params.handshake.codeVerifier,
      }),
    })
  } catch (err) {
    return {
      ok: false,
      reason: "token_exchange_failed",
      detail: err instanceof Error ? err.message : String(err),
    }
  }

  if (!response.ok) {
    return { ok: false, reason: "token_exchange_failed", detail: `HTTP ${response.status}` }
  }

  const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null
  if (!body || typeof body.id_token !== "string" || !body.id_token) {
    return { ok: false, reason: "token_exchange_failed", detail: "id_token yok" }
  }
  return { ok: true, value: body.id_token }
}

export interface SsoAdminAccount {
  userId: string
  workshopId: string
  /** `PlatformAdmin.id`; yalnız bootstrap yazması başarısız olduysa null. */
  platformAdminId: string | null
  /** Üyelik bu girişte `ADMIN_EMAILS` bootstrap'ıyla açıldıysa true. */
  viaEnvBootstrap: boolean
}

/**
 * Doğrulanmış e-postanın karşılığı olan PLATFORM YÖNETİCİSİ, ya da yoksa null.
 *
 * Üyelik kararı şifreli yolla ORTAK yardımcıdadır (`resolveAdminMembership`,
 * BAK-114). Burada kullanıcı hesabı YARATILMAZ — "otomatik hesap açma yok"
 * maddesi budur; `bakimx.com` uzantılı her adres aksi hâlde ilk girişte kendine
 * konsol erişimi açardı. Ortak yardımcının yazdığı tek satır, tablo boşken
 * `ADMIN_EMAILS` listesindeki adresler için açılan `founder` bootstrap'ıdır.
 *
 * `userId`/`workshopId` reddedilen denemede de döner: denetim kaydı kiracıya
 * bağlı olduğu için (`AuditLog.workshopId` zorunlu) bu olmadan reddi
 * kaydedemeyiz.
 */
export async function resolveSsoAdmin(
  email: string
): Promise<
  | { ok: true; account: SsoAdminAccount }
  | { ok: false; reason: "no_admin_account"; userId?: string; workshopId?: string }
> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, workshopId: true, isActive: true },
  })
  if (!user) return { ok: false, reason: "no_admin_account" }
  if (!user.isActive) {
    return { ok: false, reason: "no_admin_account", userId: user.id, workshopId: user.workshopId }
  }

  // Kimlik Google tarafından doğrulanmış e-postadır; DB satırı da onunla bulundu.
  const membership = await resolveAdminMembership({ id: user.id, email: user.email ?? email })
  if (!membership) {
    return { ok: false, reason: "no_admin_account", userId: user.id, workshopId: user.workshopId }
  }

  return {
    ok: true,
    account: {
      userId: user.id,
      workshopId: user.workshopId,
      platformAdminId: membership.platformAdminId,
      viaEnvBootstrap: membership.viaEnvBootstrap,
    },
  }
}
