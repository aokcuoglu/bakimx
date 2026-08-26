import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  normalizeActivityPage,
  parseActivityDateRange,
  validWorkshopActivityId,
  WORKSHOP_ACTIVITY_PAGE_SIZE,
} from "@/lib/admin/workshop-activity-query"

describe("iş yeri aktivite sorgusu", () => {
  test("boş tarih filtresi sorguya tarih koşulu eklemez", () => {
    expect(parseActivityDateRange("", "")).toEqual({ ok: true, range: undefined })
  })

  test("tarih aralığını İstanbul gün sınırlarıyla ve bitiş dahil olacak şekilde kurar", () => {
    const result = parseActivityDateRange("2026-08-26", "2026-08-27")
    expect(result).toEqual({
      ok: true,
      range: {
        gte: new Date("2026-08-25T21:00:00.000Z"),
        lt: new Date("2026-08-27T21:00:00.000Z"),
      },
    })
  })

  test("geçersiz ve ters tarih aralıklarını reddeder", () => {
    expect(parseActivityDateRange("2026-02-31", "")).toEqual({ ok: false, error: "Geçerli bir tarih aralığı seçin." })
    expect(parseActivityDateRange("2026-08-28", "2026-08-27")).toEqual({ ok: false, error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." })
  })

  test("sayfayı geçerli sonuç aralığına sıkıştırır", () => {
    expect(normalizeActivityPage(0, 50)).toBe(1)
    expect(normalizeActivityPage(99, WORKSHOP_ACTIVITY_PAGE_SIZE + 1)).toBe(2)
  })

  test("iş yeri kimliğini sınırlar", () => {
    expect(validWorkshopActivityId("cms6e244r000001ad6ruwfx2b")).toBe(true)
    expect(validWorkshopActivityId("")).toBe(false)
    expect(validWorkshopActivityId("x".repeat(192))).toBe(false)
  })
})

test("iş yeri detayının ilk render'ı aktivite kayıtlarını sorgulamaz", () => {
  const page = readFileSync(resolve(process.cwd(), "src/app/admin/workshops/[id]/page.tsx"), "utf8")
  const activityTables = readFileSync(resolve(process.cwd(), "src/app/admin/workshop-activity-tables.tsx"), "utf8")

  for (const lookup of [
    "prisma.auditLog.findMany",
    "prisma.communicationLog.findMany",
    "prisma.reminderExecutionLog.findMany",
    "prisma.calendarSyncLog.findMany",
  ]) expect(page).not.toContain(lookup)

  expect(page).toContain("<WorkshopActivityTables workshopId={id} />")
  expect(activityTables.match(/Run Query/g)?.length).toBe(1)
  expect(activityTables).not.toContain("bg-muted/60")
})
