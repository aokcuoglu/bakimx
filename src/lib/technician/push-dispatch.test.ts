import { test, expect, mock, beforeEach, afterEach } from "bun:test"

/** `server-only` bun test çözümünde yok — bkz. notifications.test.ts açıklaması. */
mock.module("server-only", () => ({}))

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
  const sent: unknown[] = []

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

  mock.module("@/lib/push/send", () => ({
    sendPush: async (targets: unknown, payload: unknown) => {
      sent.push({ targets, payload })
      return { sent: 1, failed: 0, removed: 0 }
    },
  }))

  return { queries, sent }
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
  const { sent } = setup()
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush(BASE_EVENT)

  expect(sent).toHaveLength(1)
  const { targets, payload } = sent[0] as { targets: unknown[]; payload: Record<string, unknown> }
  expect(targets).toEqual([SUBSCRIPTION])
  expect(payload.title).toBe("Usta atandı")
  expect(payload.body).toBe("34 ABC 123 · İş Emri #42")
  expect(payload.url).toBe("/technician/orders/order-1")
})

test("VAPID yapılandırılmamışsa DB'ye hiç sorulmaz", async () => {
  const { queries, sent } = setup({ configured: false })
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush(BASE_EVENT)

  expect(queries.serviceOrder).toHaveLength(0)
  expect(sent).toHaveLength(0)
})

test("bildirilebilir olmayan aksiyon DB'ye hiç sorulmadan elenir", async () => {
  const { queries, sent } = setup()
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush({ ...BASE_EVENT, action: "order_item_added" })

  expect(queries.serviceOrder).toHaveLength(0)
  expect(sent).toHaveLength(0)
})

test("durum değişikliği (prefix'li aksiyon) da bildirilir", async () => {
  const { sent } = setup()
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush({
    ...BASE_EVENT,
    action: "order_status_changed_to_in_progress",
    metadataJson: undefined,
  })

  expect(sent).toHaveLength(1)
})

test("kiracı izolasyonu: her sorgu workshopId ile daraltılır", async () => {
  const { queries } = setup()
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush(BASE_EVENT)

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
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush({ ...BASE_EVENT, actorUserId: "user-tech" })

  const userWhere = (queries.user[0] as { where: { id?: { not: string } } }).where
  expect(userWhere.id).toEqual({ not: "user-tech" })
})

test("aktör bilinmiyorsa alıcı sorgusuna 'id != undefined' sızmaz", async () => {
  const { queries } = setup()
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush({ ...BASE_EVENT, actorUserId: undefined })

  const userWhere = (queries.user[0] as { where: Record<string, unknown> }).where
  expect("id" in userWhere).toBe(false)
})

test("iş emri atanmamışsa gönderim yok", async () => {
  const { sent } = setup({ order: { ...ORDER, assignedTechnicianId: null as unknown as string } })
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush(BASE_EVENT)

  expect(sent).toHaveLength(0)
})

test("abonelik yoksa gönderim çağrılmaz", async () => {
  const { sent } = setup({ subscriptions: [] })
  const { dispatchTechnicianPush } = await import("./push-dispatch")

  await dispatchTechnicianPush(BASE_EVENT)

  expect(sent).toHaveLength(0)
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

  expect(dispatchTechnicianPush(BASE_EVENT)).resolves.toBeUndefined()
})
