/**
 * İş yeri giriş kodu (`Workshop.loginCode`) — üretim + doğrulama (BAK-40).
 *
 * Kod, e-postasız kullanıcının hangi tenant'a ait olduğunu çözen tek bilgidir:
 * `/w/<kod>` ekranı bununla açılır, kullanıcı adları YALNIZ o tenant içinde
 * benzersizdir. Bu yüzden URL'de güvenle taşınabilir, elle yazılabilir ve QR'a
 * basılabilir olmak zorunda.
 *
 * Workshop üç ayrı yerde yaratılıyor (checkout, register, seed) — hiçbiri kodsuz
 * workshop bırakmasın diye üretim mantığı burada TEK yerde durur. Benzersizliği
 * DB'deki unique index garanti eder; çağıran taraf `P2002` yakalayıp bir sonraki
 * adayla sınırlı sayıda yeniden dener (`generateOrderReference()` ile aynı desen).
 *
 * v1'de kod uygulama içinden DEĞİŞTİRİLEMEZ: yazdırılmış QR kartları ve paylaşılmış
 * bağlantılar ölmesin. Değişiklik gerekirse destek/admin tarafından yapılır.
 *
 * Saf modül — prisma/DOM bağımlılığı yok, client bileşenlerinden de import edilebilir.
 */

import { isUniqueConstraintError } from "@/lib/prisma-errors"

export const WORKSHOP_CODE_MIN_LENGTH = 3
export const WORKSHOP_CODE_MAX_LENGTH = 20

/**
 * Uygulamanın kendi yolları ve kısa linkleri. Bir atölye bunları alırsa
 * `/w/admin` gibi bir adres iki anlama gelir; baştan yasaklamak tek çözüm.
 */
export const RESERVED_WORKSHOP_CODES: readonly string[] = [
  "login",
  "api",
  "app",
  "admin",
  "www",
  "demo",
  "invite",
  "payment",
  "s",
  "p",
]

/** Slug üretilemeyen isimler için taban (ör. yalnız emoji veya 2 harflik ad). */
const FALLBACK_BASE = "atolye"

/**
 * Küçük harf, rakam ve tek tire; baş/son tire yok, ardışık tire yok.
 * Uzunluk ayrı kontrol edilir ki hata mesajı ayrıştırılabilsin.
 */
const WORKSHOP_CODE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Karışan karakterler (l/1, o/0) çıkarıldı — kod telefonda elle yazılıyor. */
const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const SUFFIX_LENGTH = 3

/**
 * Türkçe karakterleri ASCII'ye indirger. `toLowerCase()` ÖNCESİ çalışmak
 * zorunda: JS'te "İ".toLowerCase() → "i" + birleşen nokta (U+0307) üretir ve
 * ardından gelen `[^a-z0-9]` temizliği araya tire atar.
 */
const TURKISH_FOLD: Record<string, string> = {
  Ç: "c", ç: "c",
  Ğ: "g", ğ: "g",
  İ: "i", ı: "i", I: "i",
  Ö: "o", ö: "o",
  Ş: "s", ş: "s",
  Ü: "u", ü: "u",
  Â: "a", â: "a",
  Î: "i", î: "i",
  Û: "u", û: "u",
}

/** İş yeri adından okunabilir bir taban slug çıkarır. Boş dönebilir. */
export function slugifyWorkshopCode(name: string): string {
  return name
    .replace(/[ÇçĞğİıIÖöŞşÜüÂâÎîÛû]/g, (ch) => TURKISH_FOLD[ch] ?? ch)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // kalan aksanlar (é → e)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, WORKSHOP_CODE_MAX_LENGTH)
    .replace(/-+$/g, "") // kırpma sonrası açıkta kalan tire
}

/** Kullanıcıdan/URL'den gelen kodu karşılaştırmadan önce tek biçime getirir. */
export function normalizeWorkshopCode(value: string): string {
  return value.trim().toLowerCase()
}

export function isReservedWorkshopCode(value: string): boolean {
  return RESERVED_WORKSHOP_CODES.includes(normalizeWorkshopCode(value))
}

/**
 * Kaydedilebilir/aranabilir bir kod mu? Wizard (P2) da, `/w/<kod>` çözümlemesi
 * de aynı kapıdan geçer — biri gevşerse diğerinin bulamayacağı kod doğar.
 */
export function isValidWorkshopCode(value: string): boolean {
  const code = normalizeWorkshopCode(value)
  if (code.length < WORKSHOP_CODE_MIN_LENGTH || code.length > WORKSHOP_CODE_MAX_LENGTH) return false
  if (!WORKSHOP_CODE_PATTERN.test(code)) return false
  return !isReservedWorkshopCode(code)
}

function randomSuffix(): string {
  let s = ""
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    s += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)]
  }
  return s
}

/** İsimden türetilen, tek başına geçerli olması garanti taban. */
function workshopCodeBase(name: string): string {
  const slug = slugifyWorkshopCode(name)
  if (slug.length < WORKSHOP_CODE_MIN_LENGTH || isReservedWorkshopCode(slug)) return FALLBACK_BASE
  return slug
}

/**
 * `attempt`. denemenin kodu. 0 → sade slug (`mehmet-oto`); sonrası çakışma
 * turudur ve rastgele sonek alır (`mehmet-oto-k7p`), böylece aynı isimli iki
 * atölye birbirini kilitlemez.
 *
 * Çağıran taraf `P2002` aldıkça `attempt`'i artırarak sınırlı sayıda dener.
 */
export function workshopCodeCandidate(name: string, attempt: number = 0): string {
  const base = workshopCodeBase(name)
  if (attempt <= 0) return base

  const room = WORKSHOP_CODE_MAX_LENGTH - SUFFIX_LENGTH - 1
  const trimmed = base.slice(0, room).replace(/-+$/g, "") || FALLBACK_BASE.slice(0, room)
  return `${trimmed}-${randomSuffix()}`
}

/**
 * Prisma `P2002` hatası `Workshop.loginCode` çakışması mı?
 *
 * Kısıt bilgisinin hangi alanda durduğu istemci kurulumuna göre değişiyor —
 * gerekçe ve şekiller `@/lib/prisma-errors` içinde. Yalnız `meta.target`'a bakan
 * eski kontrol sürücü adaptörlü istemcide SESSİZCE hep `false` dönüyordu, yani
 * çakışmada yeniden deneme döngüsü hiç devreye girmiyordu (BAK-37).
 */
export function isLoginCodeConflict(error: unknown): boolean {
  return isUniqueConstraintError(error, "logincode")
}
