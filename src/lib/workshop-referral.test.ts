import { expect, test } from "bun:test"
import { getOrCreateWorkshopReferralCode } from "@/lib/workshop-referral"

test("existing referral codes stay stable", async () => {
  let writes = 0
  const code = await getOrCreateWorkshopReferralCode("workshop-1", {
    findUnique: async () => ({ referralCode: "SERVIS-2026" }),
    updateMany: async () => { writes += 1; return { count: 1 } },
  })
  expect(code).toBe("SERVIS-2026")
  expect(writes).toBe(0)
})

test("a missing code is assigned once and reused on later visits", async () => {
  let saved: string | null = null
  const store = {
    findUnique: async () => ({ referralCode: saved }),
    updateMany: async ({ data }: { data: { referralCode: string } }) => {
      saved = data.referralCode
      return { count: 1 }
    },
  }
  expect(await getOrCreateWorkshopReferralCode("workshop-1", store, () => "BX-1234567890ABCDEF")).toBe("BX-1234567890ABCDEF")
  expect(await getOrCreateWorkshopReferralCode("workshop-1", store)).toBe("BX-1234567890ABCDEF")
})

test("a concurrent assignment returns the code saved by the first request", async () => {
  let reads = 0
  const code = await getOrCreateWorkshopReferralCode("workshop-1", {
    findUnique: async () => ({ referralCode: reads++ === 0 ? null : "BX-FIRST" }),
    updateMany: async () => ({ count: 0 }),
  }, () => "BX-SECOND")
  expect(code).toBe("BX-FIRST")
})

test("a code collision retries with a fresh code", async () => {
  const assigned: string[] = []
  const code = await getOrCreateWorkshopReferralCode("workshop-1", {
    findUnique: async () => ({ referralCode: null }),
    updateMany: async ({ data }) => {
      assigned.push(data.referralCode)
      if (assigned.length === 1) throw { code: "P2002", meta: { target: ["referralCode"] } }
      return { count: 1 }
    },
  }, () => assigned.length === 0 ? "BX-COLLISION" : "BX-UNIQUE")
  expect(code).toBe("BX-UNIQUE")
  expect(assigned).toEqual(["BX-COLLISION", "BX-UNIQUE"])
})
