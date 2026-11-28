import { expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { addonFeaturesFor } from "@/lib/billing/addon-pricing"
import { applyAdminAddonsTx } from "@/lib/admin/apply-addons"

type Row = { id: string; organizationId: string | null; createdAt: Date; addons: string[]; paidAddons: string[] }

function fakeTx(rows: Row[], log: string[]) {
  return {
    $queryRaw: async (_s: TemplateStringsArray, arg: unknown) => {
      log.push(typeof arg === "string" ? `lock:${arg}` : `lock:${(arg as { values: string[] }).values.join(",")}`)
      return []
    },
    workshop: {
      findFirst: async ({ where }: { where: { id: string } }) => {
        log.push("read")
        return rows.find((r) => r.id === where.id) ?? null
      },
      findMany: async ({ where }: { where: { organizationId: string } }) => {
        log.push("read")
        return rows.filter((r) => r.organizationId === where.organizationId)
      },
      findUnique: async ({ where }: { where: { id: string } }) => rows.find((r) => r.id === where.id) ?? null,
      updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: Partial<Row> }) => {
        log.push("write")
        for (const r of rows) if (where.id.in.includes(r.id)) Object.assign(r, data)
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        log.push("write")
        Object.assign(rows.find((r) => r.id === where.id) as Row, data)
      },
    },
    auditLog: { create: async () => void log.push("audit") },
  } as unknown as Prisma.TransactionClient
}

const mk = (id: string, t: number, over: Partial<Row> = {}): Row => ({
  id,
  organizationId: "org",
  createdAt: new Date(t),
  addons: [],
  paidAddons: [],
  ...over,
})

test("önce hesap atölyesi, sonra kalan satırlar sıralı id ile kilitlenir; okuma/yazım kilitten sonra", async () => {
  const all = addonFeaturesFor(["vinLookup", "ocrIntake"])
  const rows = [mk("c", 3), mk("a", 1, { paidAddons: ["vinLookup", "ocrIntake"], addons: [...all] }), mk("b", 2, { addons: [...all] })]
  const log: string[] = []
  const without = all.filter((f) => !addonFeaturesFor(["ocrIntake"]).includes(f) || addonFeaturesFor(["vinLookup"]).includes(f))
  const res = await applyAdminAddonsTx(fakeTx(rows, log), { workshopId: "c", next: without, actorUserId: "u1" })
  expect(res.status).toBe("ok")
  expect(log.filter((l) => l.startsWith("lock:"))).toEqual(["lock:a", "lock:b,c"])
  expect(log.indexOf("write")).toBeGreaterThan(log.lastIndexOf("lock:b,c"))
  // satın alınmış anahtarın özelliği kapandı → hesap atölyesinden düştü
  expect(rows.find((r) => r.id === "a")?.paidAddons).toEqual(["vinLookup"])
})

test("hedef yoksa not_found; değişiklik yoksa yazmaz", async () => {
  const log: string[] = []
  expect((await applyAdminAddonsTx(fakeTx([], log), { workshopId: "x", next: [], actorUserId: null })).status).toBe("not_found")
  const rows = [mk("a", 1, { organizationId: null })]
  const res = await applyAdminAddonsTx(fakeTx(rows, log), { workshopId: "a", next: [], actorUserId: null })
  expect(res.status).toBe("noop")
  expect(log).not.toContain("write")
})
