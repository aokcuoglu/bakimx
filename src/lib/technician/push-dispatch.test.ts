import { test, expect, mock, beforeEach, afterEach } from "bun:test"

/** `server-only` bun test çözümünde yok — bkz. notifications.test.ts açıklaması. */
mock.module("server-only", () => ({}))

/**
 * Burada `@/lib/push/send` BİLEREK sahtelenmiyor: `mock.module` bun'da süreç
 * geneli ve kalıcıdır, yani buradaki bir sahte `src/lib/push/send.test.ts`'e
 * sızıp onu dosya sırasına göre düşürüyordu (CI kırmızısı, 19-08). Bunun
 * yerine gönderimden ayrılmış `resolveTechnicianPushDelivery` test ediliyor —
 * gerçek gönderim modülü bu dosyada hiç yüklenmiyor.
 */

type QueryLog = { serviceOrder: unknown[]; user: unknown[]; pushSubscription: unknown[] }

const ORDER = {
  id: "order-1",
  workOrderNo: "42",
  assignedTechnicianId: "tech-1",
  intakeForm: { vehicle: { plate: "34 ABC 123" } },
}

const SUBSCRIPTION = { id: "sub-1", endpoint: "https://push.example/1", p256dh: "p", auth: "a" }

function setup({
  order = ORDER as typeof ORDER | null,
  users = [{ id: "user-tech" }],
  subscriptions = [SUBSCRIPTION],
  configured = true,
}: {
  order?: typeof ORDER | null
  users?: { id: string }[]
  subscriptions?: (typeof SUBSCRIPTION)[]
  configured?: boolean
} = {}) {
  const queries: QueryLog = { serviceOrder: [], user: [], pushSubscription: [] }

  mock.module("@/lib/db", () => ({
    prisma: {
      serviceOrder: {
        findFirst: async (args: unknown) => {
          queries.serviceOrder.push(args)
          return order
        },
      },
      user: {
        findMany: async (args: unknown) => {
          queries.user.push(args)
          return users
        },
      },
      pushSubscription: {
        findMany: async (args: unknown) => {
          queries.pushSubscription.push(args)
          return subscriptions
        },
      },
    },
  }))

  mock.module("@/lib/push/config", () => ({
    isWebPushConfigured: () => configured,
    getVapidConfig: () => (configured ? { subject: "mailto:t@t", publicKey: "pub", privateKey: "priv" } : null),
  }))

  return { queries }
}

const BASE_EVENT = {
  workshopId: "w1",
  actorUserId: "user-manager",
  entityType: "ServiceOrder",
  entityId: "order-1",
  action: "technician_assigned",
  metadataJson: JSON.stringify({ technicianId: "tech-1", technicianName: "Ali" }),
  orderId: "order-1",
}

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = "pub"
  process.env.VAPID_PRIVATE_KEY = "priv"
})
afterEach(() => {
  delete process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PRIVATE_KEY
})

test("bildirilebilir olay atanmış teknisyenin cihazına gider", async () => {
  setup()
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  const delivery = await resolveTechnicianPushDelivery(BASE_EVENT)

  expect(delivery).not.toBeNull()
  expect(delivery?.targets).toEqual([SUBSCRIPTION])
  expect(delivery?.payload.title).toBe("Usta atandı")
  expect(delivery?.payload.body).toBe("34 ABC 123 · İş Emri #42")
  expect(delivery?.payload.url).toBe("/technician/orders/order-1")
})

test("VAPID yapılandırılmamışsa DB'ye hiç sorulmaz", async () => {
  const { queries } = setup({ configured: false })
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  const delivery = await resolveTechnicianPushDelivery(BASE_EVENT)

  expect(queries.serviceOrder).toHaveLength(0)
  expect(delivery).toBeNull()
})

test("bildirilebilir olmayan aksiyon DB'ye hiç sorulmadan elenir", async () => {
  const { queries } = setup()
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  const delivery = await resolveTechnicianPushDelivery({ ...BASE_EVENT, action: "order_item_added" })

  expect(queries.serviceOrder).toHaveLength(0)
  expect(delivery).toBeNull()
})

test("durum değişikliği (prefix'li aksiyon) da bildirilir", async () => {
  setup()
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  const delivery = await resolveTechnicianPushDelivery({
    ...BASE_EVENT,
    action: "order_status_changed_to_in_progress",
    metadataJson: undefined,
  })

  expect(delivery).not.toBeNull()
})

test("kiracı izolasyonu: her sorgu workshopId ile daraltılır", async () => {
  const { queries } = setup()
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  await resolveTechnicianPushDelivery(BASE_EVENT)

  const orderWhere = (queries.serviceOrder[0] as { where: Record<string, unknown> }).where
  const userWhere = (queries.user[0] as { where: Record<string, unknown> }).where
  const subWhere = (queries.pushSubscription[0] as { where: Record<string, unknown> }).where

  expect(orderWhere.workshopId).toBe("w1")
  expect(userWhere.workshopId).toBe("w1")
  expect(subWhere.workshopId).toBe("w1")
  expect(userWhere.technicianId).toBe("tech-1")
})

test("kendi yaptığı işlem kendine push üretmez (alıcı sorgusundan dışlanır)", async () => {
  const { queries } = setup()
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  await resolveTechnicianPushDelivery({ ...BASE_EVENT, actorUserId: "user-tech" })

  const userWhere = (queries.user[0] as { where: { id?: { not: string } } }).where
  expect(userWhere.id).toEqual({ not: "user-tech" })
})

test("aktör bilinmiyorsa alıcı sorgusuna 'id != undefined' sızmaz", async () => {
  const { queries } = setup()
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  await resolveTechnicianPushDelivery({ ...BASE_EVENT, actorUserId: undefined })

  const userWhere = (queries.user[0] as { where: Record<string, unknown> }).where
  expect("id" in userWhere).toBe(false)
})

test("iş emri atanmamışsa gönderim yok", async () => {
  setup({ order: { ...ORDER, assignedTechnicianId: null as unknown as string } })
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  expect(await resolveTechnicianPushDelivery(BASE_EVENT)).toBeNull()
})

test("abonelik yoksa gönderim çağrılmaz", async () => {
  setup({ subscriptions: [] })
  const { resolveTechnicianPushDelivery } = await import("./push-dispatch")

  expect(await resolveTechnicianPushDelivery(BASE_EVENT)).toBeNull()
})

test("DB hatası çağıranı kırmaz", async () => {
  setup()
  mock.module("@/lib/db", () => ({
    prisma: {
      serviceOrder: {
        findFirst: async () => {
          throw new Error("db down")
        },
      },
    },
  }))
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  // Çözümleme fırlatıyor; gönderim modülüne hiç ulaşılmadan yutulmalı.
  await expect(dispatchTechnicianPush(BASE_EVENT)).resolves.toBeUndefined()
})
