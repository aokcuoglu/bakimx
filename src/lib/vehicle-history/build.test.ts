import { test, expect } from "bun:test"
import { buildCrossWorkshopHistory, emptyCrossWorkshopHistory, type ForeignVehicleRow } from "./build"
import { MASK } from "./mask"

function row(overrides: Partial<ForeignVehicleRow> = {}): ForeignVehicleRow {
  return {
    workshopId: "ws-other",
    workshopName: "Yılmaz Oto Servis",
    workshopCity: "İstanbul",
    updatedAt: new Date("2026-03-01T10:00:00Z"),
    brand: "CITROEN",
    model: "C5 AIRCROSS",
    vehicleType: "otomobil",
    modelYear: 2021,
    color: "Beyaz",
    fuelType: "diesel",
    transmission: "automatic",
    vin: "VF7ABCDE123456789",
    engineNo: "MOTOR9988",
    mileage: 84000,
    customer: {
      type: "individual",
      firstName: "Okan",
      lastName: "Türkyılmaz",
      fullName: null,
      companyName: null,
      phone: "0532 111 22 45",
      email: "okan@ornek.com",
      city: "İstanbul",
    },
    intakes: [
      {
        createdAt: new Date("2026-03-01T09:00:00Z"),
        mileageAtIntake: 84000,
        customerComplaint: "Akü değişecek",
        damageMarks: [
          {
            zone: "sol-on-kapi",
            damageType: "scratch",
            severity: "light",
            createdAt: new Date("2026-03-01T09:05:00Z"),
          },
        ],
        order: {
          status: "delivered",
          arrivalReason: "maintenance",
          createdAt: new Date("2026-03-01T09:10:00Z"),
          itemNames: ["Akü 70Ah", "Akü değişim işçiliği"],
        },
      },
    ],
    ...overrides,
  }
}

test("maskeli: sahip, iletişim, şase ve servis adı kırpılır", () => {
  const h = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [row()], accessReason: null })

  expect(h.locked).toBe(true)
  expect(h.owner?.name).toBe(`O${MASK} T${MASK}`)
  expect(h.owner?.phone).toBe(`${MASK} 45`)
  expect(h.owner?.email).toBe(`${MASK}@${MASK}.com`)
  expect(h.vehicle?.vin).toBe(`${MASK}6789`)
  expect(h.vehicle?.engineNo).toBe(`${MASK}9988`)
  expect(h.orders[0].workshopName).toBe(MASK)
  expect(h.orders[0].workshopCity).toBeNull()
  expect(h.orders[0].complaint).toBe(MASK)
  expect(h.orders[0].itemLabels).toEqual([])
})

test("maskeli: marka/model ve toplam sayaçlar kimliksiz olduğu için görünür", () => {
  const h = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [row()], accessReason: null })

  expect(h.vehicle?.brand).toBe("CITROEN")
  expect(h.vehicle?.model).toBe("C5 AIRCROSS")
  expect(h.workshopCount).toBe(1)
  expect(h.orderCount).toBe(1)
  expect(h.lastServicedAt).toBe("2026-03-01T09:10:00.000Z")
})

test("ruhsat okutulduysa maske kalkar ve servis künyesi görünür", () => {
  const h = buildCrossWorkshopHistory({
    plate: "34ABC123",
    rows: [row()],
    accessReason: "registration_scan",
  })

  expect(h.locked).toBe(false)
  expect(h.owner?.name).toBe("Okan Türkyılmaz")
  expect(h.owner?.phone).toBe("0532 111 22 45")
  expect(h.vehicle?.vin).toBe("VF7ABCDE123456789")
  expect(h.orders[0].workshopName).toBe("Yılmaz Oto Servis")
  expect(h.orders[0].workshopCity).toBe("İstanbul")
  expect(h.orders[0].complaint).toBe("Akü değişecek")
  expect(h.orders[0].itemLabels).toEqual(["Akü 70Ah", "Akü değişim işçiliği"])
})

test("atölyenin kendi kaydı varsa da maske kalkar", () => {
  const h = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [row()], accessReason: "own_record" })
  expect(h.locked).toBe(false)
  expect(h.accessReason).toBe("own_record")
})

test("kurumsal sahip: unvan baş harfleriyle maskelenir", () => {
  const h = buildCrossWorkshopHistory({
    plate: "34ABC123",
    rows: [
      row({
        customer: {
          type: "corporate",
          firstName: null,
          lastName: null,
          fullName: null,
          companyName: "TECHPOL OTOMOTİV",
          phone: "02121112233",
          email: null,
          city: null,
        },
      }),
    ],
    accessReason: null,
  })
  expect(h.owner?.name).toBe(`T${MASK} O${MASK}`)
  expect(h.owner?.email).toBeNull()
  expect(h.owner?.city).toBeNull()
})

test("araç künyesi EN TAZE yabancı kayıttan alınır", () => {
  const stale = row({
    workshopId: "ws-eski",
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    color: "Siyah",
    mileage: 10,
    intakes: [],
  })
  const fresh = row({ workshopId: "ws-yeni", updatedAt: new Date("2026-06-01T00:00:00Z"), color: "Beyaz" })

  const h = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [stale, fresh], accessReason: "own_record" })
  expect(h.vehicle?.color).toBe("Beyaz")
  expect(h.workshopCount).toBe(2)
})

test("iş emri olmayan kabuller iş emri geçmişine girmez ama hasarları sayılır", () => {
  const h = buildCrossWorkshopHistory({
    plate: "34ABC123",
    rows: [
      row({
        intakes: [
          {
            createdAt: new Date("2026-02-01T00:00:00Z"),
            mileageAtIntake: 100,
            customerComplaint: "Sadece bakıldı",
            damageMarks: [
              { zone: "arka-tampon", damageType: "dent", severity: "medium", createdAt: new Date("2026-02-01T00:00:00Z") },
            ],
            order: null,
          },
        ],
      }),
    ],
    accessReason: "own_record",
  })
  expect(h.orderCount).toBe(0)
  expect(h.damageMarks).toHaveLength(1)
  expect(h.lastServicedAt).toBeNull()
})

test("iş emirleri en yeniden eskiye sıralanır", () => {
  const older = row({
    workshopId: "ws-a",
    intakes: [
      {
        createdAt: new Date("2025-01-01T00:00:00Z"),
        mileageAtIntake: null,
        customerComplaint: null,
        damageMarks: [],
        order: { status: "delivered", arrivalReason: null, createdAt: new Date("2025-01-01T00:00:00Z"), itemNames: [] },
      },
    ],
  })
  const h = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [older, row()], accessReason: "own_record" })
  expect(h.orders.map((o) => o.servicedAt)).toEqual([
    "2026-03-01T09:10:00.000Z",
    "2025-01-01T00:00:00.000Z",
  ])
})

test("yabancı iş emirlerinden yalnız teslim edilenler istemciye açılır", () => {
  const statuses = ["draft", "waiting_approval", "cancelled", "delivered"]
  const h = buildCrossWorkshopHistory({
    plate: "34ABC123",
    rows: [
      row({
        intakes: statuses.map((status, index) => ({
          createdAt: new Date(`2026-03-0${index + 1}T09:00:00Z`),
          mileageAtIntake: 84000 + index,
          customerComplaint: `${status} şikayeti`,
          damageMarks: [],
          order: {
            status,
            arrivalReason: status,
            createdAt: new Date(`2026-03-0${index + 1}T09:10:00Z`),
            itemNames: [`${status} kalemi`],
          },
        })),
      }),
    ],
    accessReason: "own_record",
  })

  expect(h.orderCount).toBe(1)
  expect(h.orders).toHaveLength(1)
  expect(h.orders[0]).toMatchObject({
    status: "delivered",
    arrivalReason: "delivered",
    complaint: "delivered şikayeti",
    itemLabels: ["delivered kalemi"],
  })
})

test("teslim edilmemiş yabancı emirlerin ayrıntıları maskesiz yanıtta bile sızmaz", () => {
  const h = buildCrossWorkshopHistory({
    plate: "34ABC123",
    rows: [
      row({
        intakes: [
          {
            createdAt: new Date("2026-03-01T09:00:00Z"),
            mileageAtIntake: 84000,
            customerComplaint: "GİZLİ TASLAK ŞİKAYETİ",
            damageMarks: [],
            order: {
              status: "draft",
              arrivalReason: "GİZLİ TASLAK NEDENİ",
              createdAt: new Date("2026-03-01T09:10:00Z"),
              itemNames: ["GİZLİ TASLAK KALEMİ"],
            },
          },
        ],
      }),
    ],
    accessReason: "registration_scan",
  })

  expect(JSON.stringify(h)).not.toContain("GİZLİ TASLAK")
  expect(h.orders).toEqual([])
})

test("yabancı kayıt yoksa boş sonuç kilitli görünmez", () => {
  const h = emptyCrossWorkshopHistory("34ABC123")
  expect(h.locked).toBe(false)
  expect(h.workshopCount).toBe(0)
  expect(h.orders).toEqual([])
})

test("iş emri anahtarı, yabancı kiracının gerçek id'sini taşımaz", () => {
  const h = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [row()], accessReason: "own_record" })
  // Anahtar yalnız atölye + sıra numarasıdır; tıklanabilir bir rota kurulamaz.
  expect(h.orders[0].key).toBe("ws-other:o0")
})
