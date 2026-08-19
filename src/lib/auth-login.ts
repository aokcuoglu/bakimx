import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { getPlanState, isPlanExpiredLock, type PlanExpiredLockReason } from "@/lib/plan"
import { rateLimit } from "@/lib/rate-limit"
import { isEmailIdentifier, isValidUsername, normalizeUsername } from "@/lib/user-identity"
import { isValidWorkshopCode, normalizeWorkshopCode } from "@/lib/workshop-code"

/**
 * Shared, hardened login core used by both the `/api/auth/login` route and the
 * `loginAction` server action so there is a single, consistent auth path.
 *
 * İki kimlik yolu tek fonksiyondan geçer (BAK-40): girdi `@` içeriyorsa bugünkü
 * e-posta akışı aynen çalışır, içermiyorsa `(workshopId, username)` ile çözülür —
 * yani çağıran taraf iş yeri kodunu çözmüş olmalı.
 *
 * Protections:
 *  - account enumeration: an unknown e-mail / username still runs a bcrypt
 *    comparison against a fixed dummy hash so the response timing matches the
 *    wrong-password path (no fast "user not found" exit).
 *  - rate limiting: per-client-IP cap PLUS a per-account cap
 *    (see `loginRateLimit` / `loginAccountRateLimit`).
 */

// Pre-computed bcrypt hash (cost 12) of a random string. Never matches a real
// password; used only to equalize timing on the unknown-email path.
const DUMMY_PASSWORD_HASH = "$2b$12$y1Gj5wAfKoZb8LIr83/3s.fWWfiLbYhgB08D9fqk4xZILKzrGNl8y"

// Generic message — identical for unknown e-mail, unknown username and wrong
// password (kullanıcı adı enumerasyonu yok).
export const INVALID_CREDENTIALS_MESSAGE = "E-posta adresi, kullanıcı adı veya şifre hatalı"
export const NO_WORKSHOP_MESSAGE =
  "Hesabınıza bağlı iş yeri bulunamadı. Lütfen destek ile iletişime geçin."
export const TOO_MANY_ATTEMPTS_MESSAGE =
  "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin."
export const ACCOUNT_REJECTED_MESSAGE =
  "Başvurunuz onaylanmadı. Lütfen destek ile iletişime geçin."

/**
 * Tek atölye wifi'sinden giren 6 usta AYNI IP'yi paylaşır. IP kovası 8'de
 * kesseydi biri şifresini birkaç kez yanlış girdiğinde tüm servis kilitlenirdi;
 * bu yüzden IP eşiği paylaşımlı kullanımı taşıyacak kadar yüksek, asıl kaba
 * kuvvet freni ise hesap bazlı kovadır (BAK-40).
 */
const LOGIN_IP_MAX_ATTEMPTS = 40
const LOGIN_ACCOUNT_MAX_ATTEMPTS = 8
const LOGIN_WINDOW_MS = 60_000

export type LoginResult =
  | {
      ok: true
      userId: string
      workshopId: string
      role: string
      /**
       * Sahibin ürettiği geçici şifreyle girildi — çağıran taraf kullanıcıyı
       * şifre değiştirme ekranına yönlendirir (ekran P1'de gelir).
       */
      mustChangePassword: boolean
      /**
       * Giriş başarılı ama planı bitmiş (deneme/abonelik) workshop'lar için
       * dolu gelir. Çağıran taraf kullanıcıyı /dashboard yerine /checkout'a
       * yönlendirir — uygulama rotaları bu durumda oturumu zaten kapatır
       * (bkz. (app)/layout.tsx). `pending` KAPSAM DIŞI: onlar kart doğrulama
       * ekranına (PlanLocked) düşmeye devam eder.
       */
      planExpiredReason: PlanExpiredLockReason | null
    }
  | { ok: false; error: string }

/** Planı bitmiş workshop'ların girişten sonra yönlendirileceği sayfa. */
export const PLAN_EXPIRED_LOGIN_REDIRECT = "/checkout"

/**
 * Extract a best-effort client IP from request headers for rate-limit keying.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return headers.get("x-real-ip") || "unknown"
}

/**
 * Per-IP login rate limit. Returns whether the attempt is allowed.
 *
 * Paylaşımlı NAT'ı (tek atölye wifi'si) taşıyacak kadar geniştir; hesabı asıl
 * koruyan `loginAccountRateLimit`'tir. İkisi birlikte çağrılmalı.
 */
export function loginRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  return rateLimit(`login:${ip}`, LOGIN_IP_MAX_ATTEMPTS, LOGIN_WINDOW_MS)
}

/**
 * Hesap bazlı giriş limiti — kova `(workshopId, kimlik)` ikilisine bağlıdır.
 * Aynı IP'den giren başka bir kullanıcı bu kovayı tüketmez, yani bir ustanın
 * hatalı denemesi ekibin geri kalanını kilitlemez.
 *
 * E-posta yolunda `workshopId` bilinmez (henüz kullanıcıya bakılmadı); e-posta
 * global benzersiz olduğu için kimliğin kendisi zaten hesabı tekilleştirir.
 */
export function loginAccountRateLimit(
  identifier: string,
  workshopId?: string | null
): { allowed: boolean; retryAfterMs: number } {
  const value = identifier.trim().toLowerCase()
  const scope = isEmailIdentifier(value) ? "email" : (workshopId ?? "unknown")
  return rateLimit(`login:acct:${scope}:${value}`, LOGIN_ACCOUNT_MAX_ATTEMPTS, LOGIN_WINDOW_MS)
}

export type VerifyCredentialsInput = {
  /** E-posta VEYA kullanıcı adı. `@` içeriyorsa e-posta yolu seçilir. */
  identifier: string
  password: string
  /**
   * Kullanıcı adı yolunda ZORUNLU — kullanıcı adları yalnız tenant içinde
   * benzersiz olduğu için çağıran taraf iş yeri kodunu çözmüş olmalı
   * (bkz. `resolveWorkshopIdByLoginCode`). E-posta yolunda yok sayılır.
   */
  workshopId?: string | null
}

/**
 * İş yeri kodundan tenant'ı çözer. Geçersiz formatlı kod DB'ye hiç gitmez.
 * Bulunamayan kod `null` döner — çağıran taraf bunu jenerik hataya çevirmeli
 * (var olan atölyeleri saymaya yarayan bir oracle bırakmamak için).
 */
export async function resolveWorkshopIdByLoginCode(loginCode: string): Promise<string | null> {
  const code = normalizeWorkshopCode(loginCode)
  if (!isValidWorkshopCode(code)) return null
  const workshop = await prisma.workshop.findUnique({
    where: { loginCode: code },
    select: { id: true },
  })
  return workshop?.id ?? null
}

/**
 * Kimliği kullanıcı kaydına çözer. Eşleşme yoksa `null` döner — çağıran taraf
 * sahte bcrypt karşılaştırmasını yine de çalıştırır (zamanlama sızıntısı yok).
 */
async function findUserByIdentifier(identifier: string, workshopId?: string | null) {
  const select = {
    id: true,
    password: true,
    isActive: true,
    workshopId: true,
    mustChangePassword: true,
    role: true,
  } as const

  const value = identifier.trim()
  if (isEmailIdentifier(value)) {
    return prisma.user.findUnique({ where: { email: value.toLowerCase() }, select })
  }

  // Kullanıcı adı yolu tenant'sız çözülemez; iş yeri kodu gelmemişse eşleşme yok.
  if (!workshopId) return null
  const username = normalizeUsername(value)
  if (!isValidUsername(username)) return null
  return prisma.user.findUnique({
    where: { workshopId_username: { workshopId, username } },
    select,
  })
}

/**
 * Verify credentials in constant-ish time. Always performs a bcrypt comparison
 * (real hash or dummy) before returning a generic failure.
 */
export async function verifyCredentials({
  identifier,
  password,
  workshopId: scopeWorkshopId,
}: VerifyCredentialsInput): Promise<LoginResult> {
  const user = await findUserByIdentifier(identifier, scopeWorkshopId)

  // Equalize timing: compare against a dummy hash when the user is unknown.
  const hashToCompare = user?.password ?? DUMMY_PASSWORD_HASH
  const passwordValid = await bcrypt.compare(password, hashToCompare)

  if (!user || !passwordValid) {
    return { ok: false, error: INVALID_CREDENTIALS_MESSAGE }
  }

  // Soft-disabled seats cannot sign in. Placed after the password check so it
  // reveals nothing about account existence (reached only on correct creds).
  if (!user.isActive) {
    return { ok: false, error: INVALID_CREDENTIALS_MESSAGE }
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: {
      id: true,
      approvalStatus: true,
      // Plan alanları: giriş sonrası hedefi belirlemek için (paywall → /checkout).
      planTier: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodEnd: true,
    },
  })
  if (!workshop) {
    return { ok: false, error: NO_WORKSHOP_MESSAGE }
  }

  // Rejected accounts are suspended and cannot sign in. (Reached only after a
  // correct password, so no enumeration risk.)
  //
  // `pending` workshops are NOT blocked here: they authenticate and land on the
  // full-screen PlanLocked verify screen (see (app)/layout.tsx), which lets the
  // owner resend the e-mail verification link and start the trial.
  // Blocking pending at login would make that recovery path unreachable.
  if (workshop.approvalStatus === "rejected") {
    return { ok: false, error: ACCOUNT_REJECTED_MESSAGE }
  }

  // Deneme/abonelik bitmişse oturum yine açılır (ödeme yapabilmesi için) ama
  // kullanıcı uygulama yerine /checkout'a yönlendirilir.
  const { lockReason } = getPlanState(workshop)

  return {
    ok: true,
    userId: user.id,
    workshopId: user.workshopId,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    planExpiredReason: isPlanExpiredLock(lockReason) ? lockReason : null,
  }
}
