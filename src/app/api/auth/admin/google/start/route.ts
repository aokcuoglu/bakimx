import { NextResponse } from "next/server"
import {
  buildAuthorizationUrl,
  codeChallengeS256,
  createHandshake,
  getAdminSsoConfig,
  logAdminSsoDisabled,
  resolveRedirectUri,
} from "@/lib/admin-sso"
import { saveHandshake } from "@/lib/admin-sso-cookie"

/**
 * `/admin` Google Workspace SSO'sunun başlangıcı (BAK-94).
 *
 * Yapılandırma yoksa 404 — "Google ile devam et" düğmesi zaten render edilmez,
 * bu ikinci kapı doğrudan URL'i deneyeni de karşılar ve durumu loglar.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const config = getAdminSsoConfig()
  if (!config) {
    logAdminSsoDisabled("start")
    return new NextResponse(null, { status: 404 })
  }

  const handshake = createHandshake(resolveRedirectUri(request))
  await saveHandshake(handshake)

  const challenge = await codeChallengeS256(handshake.codeVerifier)
  return NextResponse.redirect(buildAuthorizationUrl(config, handshake, challenge))
}
