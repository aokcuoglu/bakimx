import { describe, expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { ensureMembership } from "@/lib/membership"

describe("ensureMembership", () => {
  test("yalnız eksik koltuğu oluşturur, var olanı değiştirmez (update boş)", async () => {
    const calls: Array<{
      where: unknown
      create: { userId: string; workshopId: string; role: string; isActive: boolean }
      update: unknown
    }> = []
    const tx = {
      workshopMembership: {
        upsert: async (arg: (typeof calls)[number]) => {
          calls.push(arg)
        },
      },
    } as unknown as Prisma.TransactionClient

    await ensureMembership({ userId: "u1", workshopId: "w1", role: "owner", tx })

    expect(calls).toHaveLength(1)
    expect(calls[0].where).toEqual({ userId_workshopId: { userId: "u1", workshopId: "w1" } })
    expect(calls[0].create).toEqual({
      userId: "u1",
      workshopId: "w1",
      role: "owner",
      isActive: true,
    })
    expect(calls[0].update).toEqual({})
  })
})
