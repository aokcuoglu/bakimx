import { NextResponse } from "next/server"
import {
  ADMIN_LOGIN_PATH,
  exchangeCodeForIdToken,
  getAdminSsoConfig,
  logAdminSsoDisabled,
  resolveRedirectUri,
  resolveSsoAdmin,
  verifyGoogleIdToken,
  type AdminSsoRejection,
} from "@/lib/admin-sso"
import { takeHandshake } from "@/lib/admin-sso-cookie"
import { AuditLogAction } from "@/lib/audit"
import { establishSession } from "@/lib/session"

/**
 * Google OIDC dönüş ucu (BAK-94).
 *
 * Sıra bilinçlidir — pahalı işten önce ucuz kapı: yapılandırma → `state` →
 * token değişimi → jeton doğrulaması (imza/`iss`/`aud`/`exp`/`nonce`/
 * `email_verified`/`hd`) → DB'de PLATFORM YÖNETİCİSİ kaydı. Son adım olmadan
 * oturum açılmaz; burada hesap YARATILMAZ.
 */
export const dynamic = "force-dynamic"

/**
 * Reddedilen deneme denetim kaydına düşer — AMA `AuditLog.workshopId` zorunlu
 * olduğu için yalnız bir kiracıya bağlanabilen (yani `User` satırı olan)
 * denemeler yazılabilir. Kullanıcı satırı hiç olmayan bir deneme sunucu logunda
 * kalır. Platform seviyesinde denetim tablosu ayrı bir iştir.
 */
async function auditRejection(
  workshopId: string | undefined,
  userId: string | undefined,
  reason: AdminSsoRejection,
  email: string | null
): Promise<void> {
  if (!workshopId) return
  try {
    await AuditLogAction(
      workshopId,
      userId,
      "PlatformAdminSso",
      userId ?? "unknown",
      "platform_admin_sso_rejected",
      JSON.stringify({ reason, email })
    )
  } catch (err) {
    console.error("[admin-sso] denetim kaydı yazılamadı:", err instanceof Error ? err.message : err)
  }
}

function failure(
  origin: string,
  reason: AdminSsoRejection,
  email: string | null,
  detail?: string
): NextResponse {
  console.warn(
    `[admin-sso] giriş reddedildi: reason=${reason}${email ? ` email=${email}` : ""}${detail ? ` detail=${detail}` : ""}`
  )
  const url = new URL(ADMIN_LOGIN_PATH, origin)
  url.searchParams.set("error", reason)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const config = getAdminSsoConfig()
  if (!config) {
    logAdminSsoDisabled("callback")
    return new NextResponse(null, { status: 404 })
  }

  // El sıkışma çerezi tek kullanımlıktır: hangi dalda çıkarsak çıkalım silinmiş olur.
  const handshake = await takeHandshake()
  const origin = handshake ? new URL(handshake.redirectUri).origin : new URL(resolveRedirectUri(request)).origin
  const params = new URL(request.url).searchParams

  const providerError = params.get("error")
  if (providerError) return failure(origin, "provider_error", null, providerError)

  const code = params.get("code")
  const state = params.get("state")
  if (!code || !state) return failure(origin, "invalid_request", null)
  if (!handshake || handshake.state !== state) return failure(origin, "invalid_state", null)

  const token = await exchangeCodeForIdToken({ code, handshake, config })
  if (!token.ok) return failure(origin, token.reason, null, token.detail)

  const identity = await verifyGoogleIdToken({
    idToken: token.value,
    clientId: config.clientId,
    allowedDomain: config.allowedDomain,
    expectedNonce: handshake.nonce,
  })
  if (!identity.ok) return failure(origin, identity.reason, null, identity.detail)

  const lookup = await resolveSsoAdmin(identity.value.email)
  if (!lookup.ok) {
    await auditRejection(lookup.workshopId, lookup.userId, "no_admin_account", identity.value.email)
    return failure(origin, "no_admin_account", identity.value.email)
  }

  // Tek oturum mekanizması: `authenticatedAt` damgası burada da basılır, böylece
  // `PlatformAdmin.sessionsValidFrom` ile iptal SSO oturumlarında da işler (BAK-93).
  await establishSession(lookup.account.userId, lookup.account.workshopId)

  try {
    await AuditLogAction(
      lookup.account.workshopId,
      lookup.account.userId,
      "PlatformAdmin",
      lookup.account.platformAdminId,
      "platform_admin_sso_login",
      JSON.stringify({ email: identity.value.email, hd: identity.value.hd })
    )
  } catch (err) {
    console.error("[admin-sso] giriş denetim kaydı yazılamadı:", err instanceof Error ? err.message : err)
  }

  return NextResponse.redirect(new URL("/admin", origin))
}
