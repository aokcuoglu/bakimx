import { expect, test } from "bun:test"
import {
  pickWarningThreshold,
  trialTemplateKey,
  subscriptionTemplateKey,
  shouldCancelStaleOrder,
  shouldPurgeUnverifiedWorkshop,
  resolvePurgeLegacyCutoff,
} from "./lifecycle"

const TRIAL_THRESHOLDS = [3, 1, 0]
const SUB_THRESHOLDS = [7, 3, 1, 0]

test("pickWarningThreshold: eşiğe tam denk gelen gün → o eşik seçilir", () => {
  expect(pickWarningThreshold(3, new Set(), TRIAL_THRESHOLDS)).toBe(3)
  expect(pickWarningThreshold(1, new Set(), TRIAL_THRESHOLDS)).toBe(1)
  expect(pickWarningThreshold(0, new Set(), TRIAL_THRESHOLDS)).toBe(0)
})

test("pickWarningThreshold: kaçırılan gün senaryosu — cron t3 gününü kaçırdı, ertesi gün daysLeft=2 iken t3 hâlâ gönderilmemişse t3 key'iyle gönderilir", () => {
  // daysLeft=2: t=3 koşulu (2<=3) sağlanır, t=1 ve t=0 sağlanmaz (2<=1, 2<=0 yanlış).
  // Tek aday t=3 — henüz gönderilmemiş → seçilir (fall-through yok, sadece tek aday var).
  expect(pickWarningThreshold(2, new Set(), TRIAL_THRESHOLDS)).toBe(3)
})

test("pickWarningThreshold: eşik zaten gönderildiyse null döner (fall-through yok)", () => {
  // daysLeft=2 için tek aday t=3; t=3 zaten gönderildiyse başka eşiğe düşülmez.
  expect(pickWarningThreshold(2, new Set([3]), TRIAL_THRESHOLDS)).toBeNull()
})

test("pickWarningThreshold: birden çok eşik sağlanıyorsa EN KÜÇÜK (en acil) eşik seçilir", () => {
  // daysLeft=0: t=3,1,0 hepsi sağlanır (0<=3, 0<=1, 0<=0) → en küçüğü olan 0 seçilir.
  expect(pickWarningThreshold(0, new Set(), TRIAL_THRESHOLDS)).toBe(0)
  // t=1 ve t=3 daha önce gönderilmiş olsa da t=0 henüz gönderilmediyse t=0 gönderilir.
  expect(pickWarningThreshold(0, new Set([3, 1]), TRIAL_THRESHOLDS)).toBe(0)
})

test("pickWarningThreshold: en küçük uygun eşik de gönderilmişse null (daha büyük eşiklere geri dönülmez)", () => {
  expect(pickWarningThreshold(0, new Set([3, 1, 0]), TRIAL_THRESHOLDS)).toBeNull()
})

test("pickWarningThreshold: hiçbir eşik koşulu sağlanmıyorsa null", () => {
  // daysLeft=5 > tüm eşikler (max 3) → henüz uyarı zamanı değil.
  expect(pickWarningThreshold(5, new Set(), TRIAL_THRESHOLDS)).toBeNull()
})

test("pickWarningThreshold: abonelik eşikleri (7/3/1/0) ile de aynı kural çalışır", () => {
  expect(pickWarningThreshold(7, new Set(), SUB_THRESHOLDS)).toBe(7)
  expect(pickWarningThreshold(5, new Set(), SUB_THRESHOLDS)).toBe(7) // kaçırılan T-7 → T-7 key'iyle geç gönderim
  expect(pickWarningThreshold(5, new Set([7]), SUB_THRESHOLDS)).toBeNull()
  // daysLeft=2: yalnız t=7 ve t=3 sağlanır (2<=1 ve 2<=0 yanlış); ikisi de
  // gönderilmişse t=1'e "geri düşülmez" (fall-through yok) → null.
  expect(pickWarningThreshold(2, new Set([7, 3]), SUB_THRESHOLDS)).toBeNull()
  // t=1 henüz gönderilmemişse ve daysLeft=1 ise (tam eşik) t=1 seçilir.
  expect(pickWarningThreshold(1, new Set([7, 3]), SUB_THRESHOLDS)).toBe(1)
})

test("trialTemplateKey: trial penceresi (trialEndsAt) gömülü — yeniden-trial'da (un-reject) doğal reset", () => {
  const trialEndsAt = new Date("2026-07-12T00:00:00.000Z")
  expect(trialTemplateKey(3, trialEndsAt)).toBe("trial_expiry_t3:2026-07-12")
  expect(trialTemplateKey(0, trialEndsAt)).toBe("trial_expiry_t0:2026-07-12")
  // Yeni bir trial penceresi (farklı trialEndsAt) → farklı anahtar → dedup resetlenir.
  expect(trialTemplateKey(3, new Date("2026-09-01T00:00:00.000Z"))).toBe("trial_expiry_t3:2026-09-01")
})

test("subscriptionTemplateKey: dönem tarihi gömülü (yenilemede doğal reset)", () => {
  const periodEnd = new Date("2026-08-06T00:00:00.000Z")
  expect(subscriptionTemplateKey(7, periodEnd)).toBe("sub_expiry_t7:2026-08-06")
  expect(subscriptionTemplateKey(0, periodEnd)).toBe("sub_expiry_t0:2026-08-06")
})

// ---- shouldCancelStaleOrder ----

const NOW = new Date("2026-07-06T12:00:00.000Z")
const DAY = 86_400_000
const HOUR = 60 * 60 * 1000
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY)
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * HOUR)

test("shouldCancelStaleOrder: 7 günden eski + hiç transaction yok → iptal edilir", () => {
  expect(shouldCancelStaleOrder({ createdAt: daysAgo(8) }, [], NOW)).toBe(true)
})

test("shouldCancelStaleOrder: 7 günden yeni sipariş → iptal edilmez (pencere dolmadı)", () => {
  expect(shouldCancelStaleOrder({ createdAt: daysAgo(6) }, [], NOW)).toBe(false)
})

test("shouldCancelStaleOrder: canlı ödeme denemesi (initiated) varsa iptal edilmez — yaşı ne olursa olsun", () => {
  // KRİTİK yarış senaryosu: kullanıcı eski pending_payment sipariş üzerinde
  // ödemeyi YENİDEN denedi; cron tam banka çekimi sırasında siparişi iptal
  // ederse para çekilir ama aktivasyon "zaten işlenmiş" der → asla iptal etme.
  expect(
    shouldCancelStaleOrder(
      { createdAt: daysAgo(10) },
      [{ status: "initiated", createdAt: hoursAgo(0.1) }],
      NOW,
    ),
  ).toBe(false)
  // Eski bir initiated bile (henüz expired süpürmesinden geçmemiş) iptali bloklar.
  expect(
    shouldCancelStaleOrder(
      { createdAt: daysAgo(10) },
      [{ status: "initiated", createdAt: daysAgo(3) }],
      NOW,
    ),
  ).toBe(false)
})

test("shouldCancelStaleOrder: callback_received (takılı/aktivasyon bekleyen) varsa iptal edilmez", () => {
  expect(
    shouldCancelStaleOrder(
      { createdAt: daysAgo(10) },
      [{ status: "callback_received", createdAt: daysAgo(2) }],
      NOW,
    ),
  ).toBe(false)
})

test("shouldCancelStaleOrder: son transaction 24 saatten yeniyse iptal edilmez (terminal durumda olsa bile)", () => {
  // failed/expired olsa da: 24s içinde denenmişse kullanıcı hâlâ aktif —
  // yeni bir deneme her an gelebilir, siparişi ayakta tut.
  expect(
    shouldCancelStaleOrder(
      { createdAt: daysAgo(10) },
      [
        { status: "failed", createdAt: daysAgo(5) },
        { status: "failed", createdAt: hoursAgo(3) },
      ],
      NOW,
    ),
  ).toBe(false)
})

test("shouldCancelStaleOrder: tüm transaction'lar terminal ve 24 saatten eski → iptal edilir", () => {
  expect(
    shouldCancelStaleOrder(
      { createdAt: daysAgo(10) },
      [
        { status: "failed", createdAt: daysAgo(5) },
        { status: "expired", createdAt: daysAgo(2) },
      ],
      NOW,
    ),
  ).toBe(true)
})

// ---- shouldPurgeUnverifiedWorkshop ----

// özellik yayın tarihi; öncesi legacy pending (bu tarihten önce yaratılmış
// pending workshoplar kart-doğrulama akışından ÖNCEKİ dönemden kalma —
// süpürmeye ASLA dahil edilmez, aksi halde eski/gerçek başvurular silinir).
const CUTOFF = new Date("2026-07-07T00:00:00Z")
test("shouldPurgeUnverifiedWorkshop", () => {
  const base = { approvalStatus: "pending", trialStartedAt: null, createdAt: new Date("2026-07-08"),
    billingOrderCount: 0, serviceOrderCount: 0, liveVerificationTxnCount: 0 }
  // Bu test grubüne özel "hoursAgo": kaydın KENDİ createdAt'ına göre N saat
  // sonrası (dosya başındaki paylaşılan hoursAgo/NOW ile karıştırılmasın —
  // o farklı bir sabit ana referans noktasını temel alır).
  const hoursAgo = (n: number) => new Date(base.createdAt.getTime() + n * HOUR)
  expect(shouldPurgeUnverifiedWorkshop({ ...base }, hoursAgo(49))).toBe(true)
  expect(shouldPurgeUnverifiedWorkshop({ ...base }, hoursAgo(1))).toBe(false)          // taze
  expect(shouldPurgeUnverifiedWorkshop({ ...base, createdAt: new Date(CUTOFF.getTime() - HOUR) }, hoursAgo(999))).toBe(false) // legacy
  expect(shouldPurgeUnverifiedWorkshop({ ...base, billingOrderCount: 1 }, hoursAgo(99))).toBe(false)
  expect(shouldPurgeUnverifiedWorkshop({ ...base, serviceOrderCount: 1 }, hoursAgo(99))).toBe(false)
  expect(shouldPurgeUnverifiedWorkshop({ ...base, trialStartedAt: new Date() }, hoursAgo(99))).toBe(false)
  // KRİTİK: canlı (initiated/callback_received) doğrulama denemesi olan workshop
  // ASLA silinmez — callback_received'da takılı bir 1 TL bloke (para çekilmiş,
  // aktivasyon tamamlanmamış) retryStuckActivation ile kurtarılabilir kalmalı;
  // silmek hem banka blokesini sahipsiz bırakır hem kurtarılacak satırı yok eder.
  expect(shouldPurgeUnverifiedWorkshop({ ...base, liveVerificationTxnCount: 1 }, hoursAgo(999))).toBe(false)
})

// ---- resolvePurgeLegacyCutoff (TRIAL_PURGE_CUTOFF env override) ----

const FALLBACK = new Date("2026-07-07T00:00:00Z")

test("resolvePurgeLegacyCutoff: geçerli ISO env değeri kullanılır (gerçek deploy anına ayarlanabilir)", () => {
  const override = "2026-09-01T00:00:00Z"
  expect(resolvePurgeLegacyCutoff(override, FALLBACK).getTime()).toBe(new Date(override).getTime())
})

test("resolvePurgeLegacyCutoff: yalnız tarih (saatsiz) ISO da kabul edilir", () => {
  expect(resolvePurgeLegacyCutoff("2026-08-15", FALLBACK).getTime()).toBe(new Date("2026-08-15").getTime())
})

test("resolvePurgeLegacyCutoff: env yoksa/boşsa gömülü varsayılana düşer", () => {
  expect(resolvePurgeLegacyCutoff(undefined, FALLBACK).getTime()).toBe(FALLBACK.getTime())
  expect(resolvePurgeLegacyCutoff("", FALLBACK).getTime()).toBe(FALLBACK.getTime())
  expect(resolvePurgeLegacyCutoff("   ", FALLBACK).getTime()).toBe(FALLBACK.getTime())
})

test("resolvePurgeLegacyCutoff: çöp/geçersiz env değeri varsayılana düşer (gerçek başvuruları koru)", () => {
  expect(resolvePurgeLegacyCutoff("not-a-date", FALLBACK).getTime()).toBe(FALLBACK.getTime())
  expect(resolvePurgeLegacyCutoff("2026-13-99", FALLBACK).getTime()).toBe(FALLBACK.getTime())
})
