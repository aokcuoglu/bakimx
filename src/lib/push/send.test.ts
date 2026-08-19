import { test, expect, mock } from "bun:test"

/** `server-only` bun test çözümünde yok — bkz. src/lib/technician/notifications.test.ts. */
mock.module("server-only", () => ({}))

class FakeWebPushError extends Error {
  statusCode: number
  constructor(statusCode: number) {
    super(`push ${statusCode}`)
    this.statusCode = statusCode
  }
}

type SendOutcome = { statusCode?: number; hang?: boolean }

function setup(outcomes: Record<string, SendOutcome>) {
  const deleted: unknown[] = []
  const attempted: string[] = []

  mock.module("web-push", () => ({
    default: {
      setVapidDetails: () => undefined,
      sendNotification: async (subscription: { endpoint: string }) => {
        attempted.push(subscription.endpoint)
        const outcome = outcomes[subscription.endpoint] ?? {}
        if (outcome.statusCode) throw new FakeWebPushError(outcome.statusCode)
        return { statusCode: 201 }
      },
    },
    WebPushError: FakeWebPushError,
  }))

  mock.module("@/lib/db", () => ({
    prisma: {
      pushSubscription: {
        deleteMany: async (args: unknown) => {
          deleted.push(args)
          return { count: 1 }
        },
      },
    },
  }))

  mock.module("@/lib/push/config", () => ({
    getVapidConfig: () => ({ subject: "mailto:t@t", publicKey: "pub", privateKey: "priv" }),
    isWebPushConfigured: () => true,
  }))

  return { deleted, attempted }
}

const TARGETS = [
  { id: "sub-ok", endpoint: "https://push.example/ok", p256dh: "p", auth: "a" },
  { id: "sub-gone", endpoint: "https://push.example/gone", p256dh: "p", auth: "a" },
  { id: "sub-flaky", endpoint: "https://push.example/flaky", p256dh: "p", auth: "a" },
]

test("410/404 dönen abonelik silinir, geçici hata silinmez", async () => {
  const { deleted } = setup({
    "https://push.example/gone": { statusCode: 410 },
    "https://push.example/flaky": { statusCode: 500 },
  })
  const { sendPush } = await import("./send")

  const result = await sendPush(TARGETS, { title: "Test" })

  expect(result).toEqual({ sent: 1, failed: 2, removed: 1 })
  expect(deleted).toEqual([{ where: { id: { in: ["sub-gone"] } } }])
})

test("hiç ölü abonelik yoksa silme sorgusu hiç atılmaz", async () => {
  const { deleted } = setup({})
  const { sendPush } = await import("./send")

  const result = await sendPush(TARGETS, { title: "Test" })

  expect(result).toEqual({ sent: 3, failed: 0, removed: 0 })
  expect(deleted).toHaveLength(0)
})

test("hedef listesi boşsa push servisine hiç gidilmez", async () => {
  const { attempted } = setup({})
  const { sendPush } = await import("./send")

  const result = await sendPush([], { title: "Test" })

  expect(result).toEqual({ sent: 0, failed: 0, removed: 0 })
  expect(attempted).toHaveLength(0)
})

test("yapılandırma yoksa gönderim yapılmaz", async () => {
  const { attempted } = setup({})
  mock.module("@/lib/push/config", () => ({
    getVapidConfig: () => null,
    isWebPushConfigured: () => false,
  }))
  const { sendPush } = await import("./send")

  const result = await sendPush(TARGETS, { title: "Test" })

  expect(result).toEqual({ sent: 0, failed: 0, removed: 0 })
  expect(attempted).toHaveLength(0)
})
