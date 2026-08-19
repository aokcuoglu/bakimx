import { test, expect, mock } from "bun:test"

/**
 * `import "server-only"` normalde `bun test`de çözülemez (paket yalnız Next'in
 * build hattında var, düz Node/Bun çözümünde değil — bkz. src/lib/orders/activity.ts
 * ve src/app/admin/live-chat/data.ts, ikisi de bu yüzden testsiz). Gerçek modül
 * yerine no-op koymak yalnız import'u geçirir; davranışı DEĞİŞTİRMEZ (paket zaten
 * sunucu dışı import'ta hata fırlatmaktan başka bir şey yapmıyor).
 */
mock.module("server-only", () => ({}))

type ServiceOrderRow = {
  id: string
  workOrderNo: string | null
  intakeForm: { vehicle: { plate: string } }
}

type AuditLogRow = {
  id: string
  action: string
  metadataJson: string | null
  orderId: string | null
  entityType: string
  entityId: string
  createdAt: Date
}

function mockDb({ orders, auditRows }: { orders: ServiceOrderRow[]; auditRows: AuditLogRow[] }) {
  mock.module("@/lib/db", () => ({
    prisma: {
      serviceOrder: {
        findMany: async () => orders,
      },
      auditLog: {
        findMany: async () => auditRows,
      },
    },
  }))
}

const ORDER = {
  id: "order-1",
  workOrderNo: "42",
  intakeForm: { vehicle: { plate: "34 ABC 123" } },
}

test("teknisyene atanmış iş emri yoksa DB'ye hiç sorulmadan boş döner", async () => {
  mockDb({ orders: [], auditRows: [] })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: "tech-1",
    since: new Date("2026-01-01"),
  })

  expect(result).toEqual([])
})

test("technicianId yoksa (staff bağlı değil) boş döner", async () => {
  mockDb({ orders: [ORDER], auditRows: [] })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: null,
    since: new Date("2026-01-01"),
  })

  expect(result).toEqual([])
})

test("teknisyen ataması: entityId üzerinden orderId çözülür (orderId sütunu boş)", async () => {
  mockDb({
    orders: [ORDER],
    auditRows: [
      {
        id: "log-1",
        action: "technician_assigned",
        metadataJson: JSON.stringify({ technicianName: "Ahmet Usta" }),
        orderId: null,
        entityType: "ServiceOrder",
        entityId: "order-1",
        createdAt: new Date("2026-01-02T10:00:00Z"),
      },
    ],
  })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: "tech-1",
    since: new Date("2026-01-01"),
  })

  expect(result).toEqual([
    {
      id: "log-1",
      orderId: "order-1",
      createdAt: "2026-01-02T10:00:00.000Z",
      title: "Usta atandı",
      description: "34 ABC 123 · İş Emri #42",
    },
  ])
})

test("durum değişimi ve parça kararı: orderId sütunu doğrudan kullanılır", async () => {
  mockDb({
    orders: [ORDER],
    auditRows: [
      {
        id: "log-2",
        action: "order_status_changed_to_in_progress",
        metadataJson: null,
        orderId: "order-1",
        entityType: "ServiceOrder",
        entityId: "order-1",
        createdAt: new Date("2026-01-02T11:00:00Z"),
      },
      {
        id: "log-3",
        action: "parts_request_prepared",
        metadataJson: JSON.stringify({ partName: "Fren balatası" }),
        orderId: "order-1",
        entityType: "PartsRequest",
        entityId: "pr-1",
        createdAt: new Date("2026-01-02T12:00:00Z"),
      },
    ],
  })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: "tech-1",
    since: new Date("2026-01-01"),
  })

  expect(result.map((n: { title: string }) => n.title)).toEqual(["Durum değişti: Devam Ediyor", "Parça talebi hazırlandı: Fren balatası"])
})

test("teknisyene atanmamış bir iş emrinin kaydı orderById'de bulunamaz ve atlanır", async () => {
  mockDb({
    orders: [ORDER], // yalnız order-1 atanmış
    auditRows: [
      {
        id: "log-4",
        action: "order_status_changed_to_delivered",
        metadataJson: null,
        orderId: "order-99", // başka bir iş emri — DB filtresi normalde bunu hiç döndürmez, savunma amaçlı
        entityType: "ServiceOrder",
        entityId: "order-99",
        createdAt: new Date("2026-01-02T13:00:00Z"),
      },
    ],
  })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: "tech-1",
    since: new Date("2026-01-01"),
  })

  expect(result).toEqual([])
})

test("BAK-140: parça eklenmesi bildirim üretir, işçilik eklenmesi üretmez", async () => {
  mockDb({
    orders: [ORDER],
    auditRows: [
      {
        id: "log-part",
        action: "order_item_added",
        metadataJson: JSON.stringify({ name: "Fren balatası", type: "part", quantity: 2 }),
        orderId: "order-1",
        entityType: "ServiceOrderItem",
        entityId: "item-1",
        createdAt: new Date("2026-01-02T10:00:00Z"),
      },
      {
        id: "log-labor",
        action: "order_item_added",
        metadataJson: JSON.stringify({ name: "Yağ değişimi işçiliği", type: "labor", quantity: 1 }),
        orderId: "order-1",
        entityType: "ServiceOrderItem",
        entityId: "item-2",
        createdAt: new Date("2026-01-02T10:05:00Z"),
      },
    ],
  })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: "tech-1",
    since: new Date("2026-01-01"),
  })

  expect(result).toEqual([
    {
      id: "log-part",
      orderId: "order-1",
      createdAt: "2026-01-02T10:00:00.000Z",
      title: "Fren balatası eklendi",
      description: "34 ABC 123 · İş Emri #42",
    },
  ])
})

test("workOrderNo yoksa açıklamada yalnız plaka görünür", async () => {
  mockDb({
    orders: [{ id: "order-1", workOrderNo: null, intakeForm: { vehicle: { plate: "34 ABC 123" } } }],
    auditRows: [
      {
        id: "log-5",
        action: "parts_request_delivered",
        metadataJson: JSON.stringify({ partName: "Amortisör" }),
        orderId: "order-1",
        entityType: "PartsRequest",
        entityId: "pr-2",
        createdAt: new Date("2026-01-02T14:00:00Z"),
      },
    ],
  })
  const { getTechnicianNotifications } = await import("./notifications")

  const result = await getTechnicianNotifications({
    workshopId: "w1",
    userId: "u1",
    technicianId: "tech-1",
    since: new Date("2026-01-01"),
  })

  expect(result[0].description).toBe("34 ABC 123")
})

/**
 * BAK-129: aşağıdaki iki yordamı Faz B'nin push tetikleyicisi de kullanır.
 * Sözleşmeleri ayrıca sabitlenir — biri değişirse iki kanal birden kayar.
 */
test("isTechnicianNotifiableAction yalnız Faz A kapsamındaki olayları geçirir", async () => {
  mockDb({ orders: [], auditRows: [] })
  const { isTechnicianNotifiableAction } = await import("./notifications")

  for (const action of [
    "technician_assigned",
    "parts_request_prepared",
    "parts_request_delivered",
    "parts_request_cancelled",
    "order_status_changed_to_in_progress",
    "order_status_changed_to_delivered",
  ]) {
    expect(isTechnicianNotifiableAction(action)).toBe(true)
  }

  for (const action of ["photo_deleted", "order_payment_changed_to_paid", "customer_updated"]) {
    expect(isTechnicianNotifiableAction(action)).toBe(false)
  }

  // order_item_added parça/işçilik/dış işçilik arasında paylaşılır — ayrım
  // yalnız metadata.type ile yapılabilir (BAK-140).
  expect(isTechnicianNotifiableAction("order_item_added")).toBe(false)
  expect(isTechnicianNotifiableAction("order_item_added", null)).toBe(false)
  expect(isTechnicianNotifiableAction("order_item_added", JSON.stringify({ type: "labor" }))).toBe(false)
  expect(isTechnicianNotifiableAction("order_item_added", JSON.stringify({ type: "external_labor" }))).toBe(
    false
  )
  expect(isTechnicianNotifiableAction("order_item_added", JSON.stringify({ type: "part" }))).toBe(true)
})

test("buildNotificationDescription plaka ve iş emri numarasını birleştirir", async () => {
  mockDb({ orders: [], auditRows: [] })
  const { buildNotificationDescription } = await import("./notifications")

  expect(buildNotificationDescription("34 ABC 123", "42")).toBe("34 ABC 123 · İş Emri #42")
  expect(buildNotificationDescription("34 ABC 123", null)).toBe("34 ABC 123")
  expect(buildNotificationDescription(null, null)).toBeUndefined()
})
