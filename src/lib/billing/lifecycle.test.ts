import { expect, test } from "bun:test"
import { pickWarningThreshold, trialTemplateKey, subscriptionTemplateKey } from "./lifecycle"

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

test("trialTemplateKey: tarihsiz sabit anahtar (trial tek pencere)", () => {
  expect(trialTemplateKey(3)).toBe("trial_expiry_t3")
  expect(trialTemplateKey(0)).toBe("trial_expiry_t0")
})

test("subscriptionTemplateKey: dönem tarihi gömülü (yenilemede doğal reset)", () => {
  const periodEnd = new Date("2026-08-06T00:00:00.000Z")
  expect(subscriptionTemplateKey(7, periodEnd)).toBe("sub_expiry_t7:2026-08-06")
  expect(subscriptionTemplateKey(0, periodEnd)).toBe("sub_expiry_t0:2026-08-06")
})
