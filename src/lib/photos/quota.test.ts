import { expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { MAX_ACTIVE_PHOTOS_PER_INTAKE } from "@/lib/photos/limits"
import { assertIntakePhotoQuota } from "@/lib/photos/quota"

test("aktif fotoğrafları tenant ve ortak görünürlük filtresiyle sayar", async () => {
  let query: unknown
  const database = {
    vehiclePhoto: {
      count: async (input: unknown) => {
        query = input
        return MAX_ACTIVE_PHOTOS_PER_INTAKE - 1
      },
    },
  } as unknown as Pick<Prisma.TransactionClient, "vehiclePhoto">

  const result = await assertIntakePhotoQuota("workshop-1", "intake-1", 1, database)

  expect(result).toEqual({ ok: true })
  expect(query).toEqual({
    where: {
      workshopId: "workshop-1",
      intakeFormId: "intake-1",
      deletedAt: null,
    },
  })
})

test("eklenecek sayı sınırı aşarsa reddeder", async () => {
  const database = {
    vehiclePhoto: {
      count: async () => MAX_ACTIVE_PHOTOS_PER_INTAKE,
    },
  } as unknown as Pick<Prisma.TransactionClient, "vehiclePhoto">

  const result = await assertIntakePhotoQuota("workshop-1", "intake-1", 1, database)

  expect(result.ok).toBeFalse()
  if (!result.ok) expect(result.error).toContain("30")
})

test("kota aşım mesajı sabit üst sınırı içerir", () => {
  const active = MAX_ACTIVE_PHOTOS_PER_INTAKE
  const message = `Bu iş emrine en fazla ${MAX_ACTIVE_PHOTOS_PER_INTAKE} fotoğraf eklenebilir (şu an ${active}). Gereksiz kareleri silip tekrar deneyin.`
  expect(message).toContain("30")
  expect(active + 1).toBeGreaterThan(MAX_ACTIVE_PHOTOS_PER_INTAKE)
})
