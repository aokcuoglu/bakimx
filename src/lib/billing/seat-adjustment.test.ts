import { describe, expect, test } from "bun:test"
import { selectSeatAdjustment } from "@/lib/billing/seat-adjustment"

const date = (day: number) => new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`)

describe("seat adjustment selection", () => {
  test("retains the oldest owner first, then the oldest users", () => {
    const result = selectSeatAdjustment(
      [
        { id: "staff-old", role: "staff", createdAt: date(1), technicianId: "tech-old" },
        { id: "owner", role: "owner", createdAt: date(3), technicianId: null },
        { id: "staff-new", role: "staff", createdAt: date(4), technicianId: "tech-new" },
      ],
      [],
      2,
    )

    expect(result.retainedUserIds).toEqual(["owner", "staff-old"])
    expect(result.deactivatedUserIds).toEqual(["staff-new"])
    expect(result.technicianIdsToReview).toEqual(["tech-new"])
  })

  test("revokes only invites that no longer fit after active users", () => {
    const result = selectSeatAdjustment(
      [{ id: "owner", role: "owner", createdAt: date(1), technicianId: null }],
      [
        { id: "invite-old", createdAt: date(2) },
        { id: "invite-new", createdAt: date(3) },
      ],
      2,
    )

    expect(result.revokedInviteIds).toEqual(["invite-new"])
  })

  test("uses ids as a stable tie-breaker and deduplicates technician reviews", () => {
    const result = selectSeatAdjustment(
      [
        { id: "owner", role: "owner", createdAt: date(1), technicianId: null },
        { id: "b", role: "staff", createdAt: date(2), technicianId: "tech-shared" },
        { id: "a", role: "staff", createdAt: date(2), technicianId: "tech-shared" },
      ],
      [],
      1,
    )

    expect(result.deactivatedUserIds).toEqual(["a", "b"])
    expect(result.technicianIdsToReview).toEqual(["tech-shared"])
  })
})
