import { expect, test } from "bun:test"
import { photoUsageWhere } from "@/lib/billing/photo-usage"

test("iş emri fotoğraf raporu tenant, kabul formu ve aktif fotoğraf sınırını korur", () => {
  expect(photoUsageWhere("workshop-a", ["intake-1", "intake-2"])).toEqual({
    workshopId: "workshop-a",
    intakeFormId: { in: ["intake-1", "intake-2"] },
    deletedAt: null,
  })
})
