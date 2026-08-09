/**
 * Oturum kurtarma kuralları — "bayat çerez" sonsuz yönlendirme döngüsüne karşı.
 *
 * Sorun: oturum çerezi geçerli imzalıdır (iron-session çözer) ama işaret ettiği
 * kullanıcı artık çözülemez (silinmiş kullanıcı/atölye, yerelde yeniden seed,
 * elle veri işlemi). O anda iki katman birbirine top atar:
 *
 *   middleware  → /login isteğinde çerezde userId var  → /dashboard
 *   (app)/layout → getCurrentUser() null               → /login
 *
 * Tarayıcıda sonucu ERR_TOO_MANY_REDIRECTS'tir ve kullanıcının tek çıkışı
 * çerezi elle silmektir. Bir atölye çalışanından bu beklenemez.
 *
 * İki savunma hattı burada tanımlıdır:
 *  1. Açık sinyal — layout `?reason=session_invalid` ile /login'e yollar,
 *     middleware bunu görüp çerezi imha eder (Server Component cookie yazamaz;
 *     bu, plan kilidinin `?expired=` akışıyla aynı kanıtlanmış desendir).
 *  2. Sekme sayacı — sinyal olmasa bile, kısa ömürlü bir sayaç arka arkaya
 *     gelen /login↔/dashboard sekmelerini sayar ve limitte oturumu imha eder.
 *     Bugün bilinmeyen bir kök neden de kullanıcıyı kilitleyemesin diye.
 */

import { isPlanExpiredLock } from "@/lib/plan"

/** Çözülemeyen oturumu bildiren query parametresi (`/login?reason=…`). */
export const LOGOUT_REASON_PARAM = "reason"

/** Oturum çerezi geçerli ama karşılığı bulunamadı. */
export const SESSION_INVALID_REASON = "session_invalid"

/** Hesap oturum açıkken pasife alındı (kullanıcı çözülür ama erişimi yok). */
export const SESSION_INACTIVE_REASON = "session_inactive"

/** Sayacın limite dayanması sonucu zorla çıkış (yalnız bilgilendirme metni için). */
export const SESSION_LOOP_REASON = "session_loop"

const FORCED_LOGOUT_REASONS = new Set<string>([
  SESSION_INVALID_REASON,
  SESSION_INACTIVE_REASON,
  SESSION_LOOP_REASON,
])

/**
 * `/login` isteğinde oturum çerezi imha edilip form gösterilmeli mi?
 *
 * Tanınmayan değerler yok sayılır: uydurulmuş bir parametreyle başkasının
 * oturumu kapatılamaz (zaten yalnız isteği yapanın kendi çerezini etkiler,
 * yine de yüzeyi dar tutuyoruz).
 */
export function shouldClearSessionOnLogin(params: URLSearchParams): boolean {
  if (isPlanExpiredLock(params.get("expired"))) return true
  const reason = params.get(LOGOUT_REASON_PARAM)
  return reason !== null && FORCED_LOGOUT_REASONS.has(reason)
}

/** Sekme sayacını taşıyan çerez. Kısa ömürlüdür; sağlıklı gezinmeyi etkilemez. */
export const AUTH_BOUNCE_COOKIE = "bakimx_auth_bounce"

/**
 * Kaç sekmeden sonra oturum imha edilir. Sağlıklı bir kullanıcı /login'e girip
 * /dashboard'a atılırken sayaç 1'de kalır; gerçek döngü ise milisaniyeler
 * içinde limite dayanır.
 */
export const AUTH_BOUNCE_LIMIT = 3

/** Sayacın yaşam süresi (saniye) — deploy/gezinme aralarında birikmesin. */
export const AUTH_BOUNCE_TTL_SECONDS = 10

function parseBounce(raw: string | null | undefined): number {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : 0
}

/** Bu sekmeden sonraki sayaç değeri. Bozuk/eksik değer 1'den başlar. */
export function nextBounceCount(raw: string | null | undefined): number {
  return parseBounce(raw) + 1
}

/** Sayaç limite dayandı mı — yani oturumu imha etme zamanı mı? */
export function isBounceLimitReached(raw: string | null | undefined): boolean {
  return parseBounce(raw) >= AUTH_BOUNCE_LIMIT
}
