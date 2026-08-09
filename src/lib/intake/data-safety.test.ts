import { expect, test, describe } from "bun:test"
import { sanitizeIntakeForPublic } from "./data-safety"

const CREATED_AT = new Date("2026-07-25T16:34:00.000Z")

function baseIntake() {
  return {
    status: "in_progress",
    mileageAtIntake: null,
    fuelLevelAtIntake: null,
    customerComplaint: "bakım",
    approvedAt: null,
    createdAt: CREATED_AT,
    customer: {
      firstName: "Ali",
      lastName: "Yılmaz",
      fullName: "Ali Yılmaz",
      companyName: null,
      contactName: null,
      type: "individual",
      phone: "5551112233",
    },
    vehicle: { plate: "34ABC123", brand: "OPEL", model: "CORSA", modelYear: 2025, mileage: null, vin: null },
    photos: [],
    damageMarks: [],
    approvals: [],
    order: {
      status: "in_progress",
      paymentStatus: "unpaid",
      items: [
        { type: "part", name: "Filtre, kabin havası", quantity: 1, unitPrice: 50000, totalPrice: null },
        { type: "part", name: "Manuel parça", quantity: 1, unitPrice: null, totalPrice: null },
      ],
    },
    timelineEvents: [],
  }
}

describe("sanitizeIntakeForPublic — tutar görünürlüğü", () => {
  /**
   * Regresyon: tutarlar `showPaymentStatus`e bağlıydı. O bayrağın varsayılanı
   * `false` ve intake paylaşım linkinde onu açan hiçbir arayüz yok — yani
   * müşteri çıktısındaki "Tutar" sütunu her zaman "—" basıyordu.
   */
  test("kalemler görünürken tutarlar da gelir (showPaymentStatus kapalı olsa bile)", () => {
    const safe = sanitizeIntakeForPublic(baseIntake(), { showOrderItems: true, showPaymentStatus: false })
    expect(safe.order?.items[0].unitPrice).toBe(50000)
    // Ödeme durumu etiketi ayrı bayrağa bağlı kalır.
    expect(safe.order?.paymentStatusLabel).toBe("")
  })

  test("varsayılan görünürlükte (bayrak verilmeden) tutarlar gelir", () => {
    const safe = sanitizeIntakeForPublic(baseIntake(), {})
    expect(safe.order?.items[0].unitPrice).toBe(50000)
  })

  test("kalemler gizlenince sipariş komple düşer", () => {
    const safe = sanitizeIntakeForPublic(baseIntake(), { showOrderItems: false })
    expect(safe.order).toBeNull()
  })

  test("showPaymentStatus açıkken ödeme durumu etiketi de gelir", () => {
    const safe = sanitizeIntakeForPublic(baseIntake(), { showOrderItems: true, showPaymentStatus: true })
    expect(safe.order?.paymentStatusLabel).toBe("Ödenmedi")
    expect(safe.order?.items[0].unitPrice).toBe(50000)
  })

  test("fiyatı girilmemiş kalem null kalır", () => {
    const safe = sanitizeIntakeForPublic(baseIntake(), { showOrderItems: true })
    expect(safe.order?.items[1].unitPrice).toBeNull()
    expect(safe.order?.items[1].totalPrice).toBeNull()
  })
})
