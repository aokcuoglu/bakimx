import { afterEach, expect, test } from "bun:test"
import { SignJWT, exportJWK, generateKeyPair } from "jose"
import {
  buildAuthorizationUrl,
  codeChallengeS256,
  createHandshake,
  getAdminSsoConfig,
  resolveRedirectUri,
  verifyGoogleIdToken,
} from "./admin-sso"

/**
 * BAK-94 — `/admin` Google SSO'sunun SUNUCU tarafı doğrulaması.
 *
 * Neden bu dosya var: yetkilendirme isteğine `hd=bakimx.com` eklemek bir filtre
 * DEĞİLDİR (yalnız hesap seçicideki ipucu). Kapı burada, kimlik jetonunun
 * doğrulanmasında. O kontroller düşerse kişisel bir Gmail hesabı konsolun ilk
 * kapısını geçer — bu dosya o günü ekran açmadan kırmızıya çevirir.
 *
 * Gerçek Google'a çıkılmaz: yerelde üretilen bir anahtar çiftiyle jeton imzalanır
 * ve açık anahtar `key` parametresiyle enjekte edilir (üretimde JWKS kullanılır).
 */

const CLIENT_ID = "test-client.apps.googleusercontent.com"
const DOMAIN = "bakimx.com"
const NONCE = "nonce-abc"

const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true })
const other = await generateKeyPair("RS256", { extractable: true })

type Claims = Record<string, unknown>

async function idToken(claims: Claims, signer = privateKey, expiresIn = "5m"): Promise<string> {
  return new SignJWT({
    email: `deniz@${DOMAIN}`,
    email_verified: true,
    hd: DOMAIN,
    nonce: NONCE,
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://accounts.google.com")
    .setAudience(CLIENT_ID)
    .setSubject("google-sub-1")
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(signer)
}

function verify(token: string, expectedNonce = NONCE) {
  return verifyGoogleIdToken({
    idToken: token,
    clientId: CLIENT_ID,
    allowedDomain: DOMAIN,
    expectedNonce,
    key: publicKey,
  })
}

test("geçerli Workspace jetonu kabul edilir", async () => {
  const result = await verify(await idToken({}))
  expect(result).toEqual({ ok: true, value: { email: `deniz@${DOMAIN}`, hd: DOMAIN, subject: "google-sub-1" } })
})

test("başka anahtarla imzalanmış jeton reddedilir", async () => {
  const result = await verify(await idToken({}, other.privateKey))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("invalid_token")
})

test("yanlış aud reddedilir", async () => {
  const token = await new SignJWT({ email: `deniz@${DOMAIN}`, email_verified: true, hd: DOMAIN, nonce: NONCE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://accounts.google.com")
    .setAudience("baska-client.apps.googleusercontent.com")
    .setSubject("google-sub-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey)

  const result = await verify(token)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("invalid_token")
})

test("yanlış iss reddedilir", async () => {
  const token = await new SignJWT({ email: `deniz@${DOMAIN}`, email_verified: true, hd: DOMAIN, nonce: NONCE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://evil.example.com")
    .setAudience(CLIENT_ID)
    .setSubject("google-sub-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey)

  const result = await verify(token)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("invalid_token")
})

test("süresi geçmiş jeton reddedilir", async () => {
  const result = await verify(await idToken({}, privateKey, "-1m"))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("invalid_token")
})

test("nonce uyuşmazlığı reddedilir — yeniden oynatma kapalı", async () => {
  const result = await verify(await idToken({}), "baska-nonce")
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("nonce_mismatch")
})

test("email_verified false reddedilir", async () => {
  const result = await verify(await idToken({ email_verified: false }))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("email_unverified")
})

test("hd claim'i olmayan (kişisel Gmail) jeton reddedilir", async () => {
  const result = await verify(await idToken({ hd: undefined, email: "birisi@gmail.com" }))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("domain_not_allowed")
})

test("başka Workspace alan adı reddedilir", async () => {
  const result = await verify(await idToken({ hd: "baskafirma.com", email: "birisi@baskafirma.com" }))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("domain_not_allowed")
})

test("hd doğru ama e-posta başka alan adındaysa reddedilir", async () => {
  const result = await verify(await idToken({ hd: DOMAIN, email: "birisi@gmail.com" }))
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("domain_not_allowed")
})

test("e-posta claim'i hiç yoksa reddedilir", async () => {
  const token = await new SignJWT({ email_verified: true, hd: DOMAIN, nonce: NONCE })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer("https://accounts.google.com")
    .setAudience(CLIENT_ID)
    .setSubject("google-sub-1")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey)

  const result = await verify(token)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("invalid_token")
})

test("alg=none jetonu reddedilir", async () => {
  const jwk = await exportJWK(publicKey)
  expect(jwk.kty).toBe("RSA")
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({
      email: `deniz@${DOMAIN}`,
      email_verified: true,
      hd: DOMAIN,
      nonce: NONCE,
      iss: "https://accounts.google.com",
      aud: CLIENT_ID,
      sub: "google-sub-1",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    })
  ).toString("base64url")

  const result = await verify(`${header}.${payload}.`)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.reason).toBe("invalid_token")
})

// ── Yapılandırma ───────────────────────────────────────────────────────────

const ENV_KEYS = [
  "GOOGLE_OIDC_CLIENT_ID",
  "GOOGLE_OIDC_CLIENT_SECRET",
  "GOOGLE_OIDC_HD",
  "GOOGLE_OIDC_REDIRECT_URI",
] as const
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

test("client id/secret yoksa yapılandırma null — SSO yolu kapalı", () => {
  delete process.env.GOOGLE_OIDC_CLIENT_ID
  delete process.env.GOOGLE_OIDC_CLIENT_SECRET
  expect(getAdminSsoConfig()).toBeNull()

  process.env.GOOGLE_OIDC_CLIENT_ID = CLIENT_ID
  expect(getAdminSsoConfig()).toBeNull()
})

test("client id + secret varsa yapılandırma dolu, hd varsayılanı bakimx.com", () => {
  process.env.GOOGLE_OIDC_CLIENT_ID = CLIENT_ID
  process.env.GOOGLE_OIDC_CLIENT_SECRET = "gizli"
  delete process.env.GOOGLE_OIDC_HD
  expect(getAdminSsoConfig()).toEqual({ clientId: CLIENT_ID, clientSecret: "gizli", allowedDomain: DOMAIN })
})

// ── Callback adresi ────────────────────────────────────────────────────────

function req(host: string, url = `https://${host}/api/auth/admin/google/start`): Request {
  return new Request(url, { headers: { host } })
}

test("callback adresi ortama göre türetilir", () => {
  delete process.env.GOOGLE_OIDC_REDIRECT_URI

  expect(resolveRedirectUri(req("localhost:3000", "http://localhost:3000/api/auth/admin/google/start"))).toBe(
    "http://localhost:3000/api/auth/admin/google/callback"
  )
  expect(resolveRedirectUri(req("app-dev.bakimx.com"))).toBe(
    "https://app-dev.bakimx.com/api/auth/admin/google/callback"
  )
  expect(resolveRedirectUri(req("app.bakimx.com"))).toBe(
    "https://app.bakimx.com/api/auth/admin/google/callback"
  )
})

test("prod'da landing host'u app host'una kanonikleşir — yalnız o URI kayıtlı", () => {
  delete process.env.GOOGLE_OIDC_REDIRECT_URI
  expect(resolveRedirectUri(req("bakimx.com"))).toBe("https://app.bakimx.com/api/auth/admin/google/callback")
  expect(resolveRedirectUri(req("www.bakimx.com"))).toBe("https://app.bakimx.com/api/auth/admin/google/callback")
})

test("GOOGLE_OIDC_REDIRECT_URI verilmişse host'tan türetme yapılmaz", () => {
  process.env.GOOGLE_OIDC_REDIRECT_URI = "https://ozel.example.com/api/auth/admin/google/callback"
  expect(resolveRedirectUri(req("app.bakimx.com"))).toBe(
    "https://ozel.example.com/api/auth/admin/google/callback"
  )
})

// ── PKCE + yetkilendirme isteği ────────────────────────────────────────────

test("PKCE challenge doğrulayıcının SHA-256 base64url'ü", async () => {
  const verifier = "test-verifier-123"
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  expect(await codeChallengeS256(verifier)).toBe(Buffer.from(digest).toString("base64url"))
})

test("her el sıkışma taze state/nonce/verifier üretir", () => {
  const a = createHandshake("https://app.bakimx.com/api/auth/admin/google/callback")
  const b = createHandshake("https://app.bakimx.com/api/auth/admin/google/callback")
  expect(a.state).not.toBe(b.state)
  expect(a.nonce).not.toBe(b.nonce)
  expect(a.codeVerifier).not.toBe(b.codeVerifier)
  // PKCE RFC 7636: doğrulayıcı 43-128 karakter.
  expect(a.codeVerifier.length).toBeGreaterThanOrEqual(43)
})

test("yetkilendirme isteği state/nonce/PKCE ve hd ipucunu taşır", () => {
  const handshake = createHandshake("https://app.bakimx.com/api/auth/admin/google/callback")
  const url = new URL(
    buildAuthorizationUrl(
      { clientId: CLIENT_ID, clientSecret: "gizli", allowedDomain: DOMAIN },
      handshake,
      "challenge-xyz"
    )
  )

  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
  expect(url.searchParams.get("client_id")).toBe(CLIENT_ID)
  expect(url.searchParams.get("response_type")).toBe("code")
  expect(url.searchParams.get("redirect_uri")).toBe(handshake.redirectUri)
  expect(url.searchParams.get("state")).toBe(handshake.state)
  expect(url.searchParams.get("nonce")).toBe(handshake.nonce)
  expect(url.searchParams.get("code_challenge")).toBe("challenge-xyz")
  expect(url.searchParams.get("code_challenge_method")).toBe("S256")
  expect(url.searchParams.get("hd")).toBe(DOMAIN)
  expect(url.searchParams.get("scope")).toBe("openid email profile")
})
