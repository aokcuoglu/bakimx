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

describe("sanitizeIntakeForPublic — KDV / indirim kırılımı", () => {
  /**
   * Regresyon (BAK-75 takibi): iş emrinin `taxRate`'i ve satırların `includeVat`
   * bayrağı DTO'da hiç yoktu. Müşteri belgesi kırılımı hesaplayamıyor, ham net
   * toplamı "Genel Toplam" diye basıyordu — iş emrinde KDV %20 ve ₺80 iken
   * "Araç Kabul ve İşlem Özeti"nde KDV satırı hiç görünmüyordu.
   */
  test("indirim, KDV oranı ve satır KDV bayrağı DTO'ya taşınır", () => {
    const intake = baseIntake()
    intake.order = {
      ...intake.order,
      discountAmount: 10000,
      taxRate: 2000,
      items: [
        { type: "part", name: "Filtre", quantity: 1, unitPrice: 50000, totalPrice: null, includeVat: true },
        { type: "labor", name: "İşçilik", quantity: 1, unitPrice: 20000, totalPrice: null, includeVat: false },
      ],
    } as typeof intake.order
    const safe = sanitizeIntakeForPublic(intake, { showOrderItems: true })
    expect(safe.order?.discountAmount).toBe(10000)
    expect(safe.order?.taxRate).toBe(2000)
    expect(safe.order?.items[0].includeVat).toBe(true)
    // `false` AYNEN taşınmalı: düşerse `isVatLiable` satırı tabi sayar ve
    // müşteri belgesi KDV'siz kalemden de KDV alır.
    expect(safe.order?.items[1].includeVat).toBe(false)
  })

  test("kolon seçilmemişse bayrak null olur — tabi sayılır (geriye dönük uyum)", () => {
    const safe = sanitizeIntakeForPublic(baseIntake(), { showOrderItems: true })
    expect(safe.order?.items[0].includeVat).toBeNull()
  })
})

describe("damage/photo visibility is independent", () => {
  const intake = {
    ...baseIntake(), bodyType: "suv", inspectionStatus: "not_recorded", inspectedAt: null,
    photos: [{ id: "visible", type: "damage_detail", label: "Foto", fileUrl: "/s/token/photos/visible" }],
    damageMarks: [
      { number: 7, zone: "hood", damageType: "dent", severity: "light", note: "Kaput", photos: [{ photoId: "visible" }, { photoId: "hidden" }] },
      { number: 8, zone: "roof", damageType: "dent", severity: "light", note: "Silinen", deletedAt: CREATED_AT },
    ],
  }
  for (const showDamage of [false, true]) for (const showPhotos of [false, true]) {
    test(`damage=${showDamage}, photos=${showPhotos}`, () => {
      const result = sanitizeIntakeForPublic(intake, { showDamage, showPhotos })
      expect(result.damageMarks.length).toBe(showDamage ? 1 : 0)
      expect(result.photos.length).toBe(showPhotos ? 1 : 0)
      expect(result.inspectionStatus).toBe(showDamage ? "not_recorded" : undefined)
      if (showDamage) {
        expect(result.damageMarks[0].number).toBe(7)
        expect(result.damageMarks[0].photoIds).toEqual(showPhotos ? ["visible"] : [])
      }
      expect(JSON.stringify(result)).not.toContain('"hidden"')
      expect(JSON.stringify(result)).not.toContain("Silinen")
    })
  }
})
