import { test, expect, mock } from "bun:test"

/**
 * `import "server-only"` `bun test`de çözülemez (paket yalnız Next'in build
 * hattında var). No-op koymak yalnız import'u geçirir, davranışı DEĞİŞTİRMEZ —
 * aynı yaklaşım `src/lib/technician/notifications.test.ts`de de kullanılıyor.
 */
mock.module("server-only", () => ({}))

const { describeAuditAction } = await import("./activity")

/**
 * BAK-138 — işlem geçmişinde SAYAÇ ile ELLE DÜZELTME ayrımı.
 *
 * `LaborSession.startTime/endTime` artık geriye dönük değiştirilebiliyor. Bu
 * ayrım kaybolursa düzeltilmiş bir süre ile ölçülmüş bir süre raporda aynı
 * görünür ve iş emri geçmişi kanıt olmaktan çıkar. Etiketlerin `null` dönmesi
 * de sessiz bir kayıptır: `getOrderActivity` etiketsiz satırı akışa hiç
 * yazmaz, yani düzeltme HİÇ görünmez.
 */

test("sayaç başlatma işlem geçmişinde görünür", () => {
  const built = describeAuditAction("labor_session_started", JSON.stringify({ startTime: "2026-08-19T15:40:00.000Z" }))
  expect(built).not.toBeNull()
  expect(built?.category).toBe("labor")
  expect(built?.label).toBe("İşçilik sayacı başlatıldı")
})

test("sayaç durdurma süre ve açıklamayı detayda taşır", () => {
  const built = describeAuditAction(
    "labor_session_stopped",
    JSON.stringify({ durationMinutes: 135, note: "Balata değişimi" }),
  )
  expect(built?.label).toBe("İşçilik sayacı durduruldu")
  expect(built?.detail).toBe("2s 15dk · Balata değişimi")
})

test("notsuz durdurmada detay yalnız süredir", () => {
  const built = describeAuditAction("labor_session_stopped", JSON.stringify({ durationMinutes: 45, note: null }))
  expect(built?.detail).toBe("45dk")
})

test("elle düzeltme AYRI bir etiketle görünür ve süre değişimini yazar", () => {
  const built = describeAuditAction(
    "labor_session_edited",
    JSON.stringify({
      before: { durationMinutes: 0, note: null },
      after: { durationMinutes: 45, note: "Balata değişimi" },
    }),
  )
  expect(built?.label).toBe("İşçilik süresi elle düzeltildi")
  expect(built?.detail).toBe("0dk → 45dk · açıklama güncellendi")
})

test("yalnız açıklama düzeltildiyse süre değişimi yazılmaz", () => {
  const built = describeAuditAction(
    "labor_session_edited",
    JSON.stringify({
      before: { durationMinutes: 45, note: "eski" },
      after: { durationMinutes: 45, note: "yeni" },
    }),
  )
  expect(built?.detail).toBe("açıklama güncellendi")
})

test("sayaç ve düzeltme etiketleri BİRBİRİNDEN farklıdır", () => {
  const stopped = describeAuditAction("labor_session_stopped", JSON.stringify({ durationMinutes: 45 }))
  const edited = describeAuditAction(
    "labor_session_edited",
    JSON.stringify({ before: { durationMinutes: 30 }, after: { durationMinutes: 45 } }),
  )
  expect(stopped?.label).not.toBe(edited?.label)
})
