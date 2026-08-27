import { describe, expect, it } from "bun:test"
import {
  isSalesLeadAttributionFrozen,
  leadStatusForActivityResult,
  normalizeSalesEmail,
  normalizeSalesPhone,
  salesTaskBucket,
  taskDurationForActivityResult,
  taskTypeForActivityResult,
} from "./crm"

describe("sales CRM workflow", () => {
  it("normalizes Turkish phone and email identities", () => {
    expect(normalizeSalesPhone("+90 (532) 000 00 00")).toBe("5320000000")
    expect(normalizeSalesPhone("0532 000 00 00")).toBe("5320000000")
    expect(normalizeSalesEmail("  SATIS@ÖRNEK.COM ")).toBe("satis@örnek.com")
  })

  it("maps controlled activity results to lead stages", () => {
    expect(leadStatusForActivityResult("reached")).toBe("contacted")
    expect(leadStatusForActivityResult("demo_scheduled")).toBe("demo_scheduled")
    expect(leadStatusForActivityResult("proposal_sent")).toBe("proposal")
    expect(leadStatusForActivityResult("won")).toBe("won")
    expect(leadStatusForActivityResult("lost")).toBe("lost")
    expect(leadStatusForActivityResult("no_answer")).toBeNull()
  })

  it("derives the follow-up task defaults", () => {
    expect(taskTypeForActivityResult("demo_scheduled")).toBe("online_demo")
    expect(taskDurationForActivityResult("demo_scheduled")).toBe(60)
    expect(taskTypeForActivityResult("follow_up_required")).toBe("follow_up")
    expect(taskDurationForActivityResult("follow_up_required")).toBe(30)
  })

  it("keeps attribution frozen after the first win", () => {
    expect(isSalesLeadAttributionFrozen({ status: "won", attributionFrozenAt: null })).toBe(true)
    expect(isSalesLeadAttributionFrozen({ status: "contacted", attributionFrozenAt: new Date() })).toBe(true)
    expect(isSalesLeadAttributionFrozen({ status: "contacted", attributionFrozenAt: null })).toBe(false)
  })

  it("splits scheduled tasks into overdue, today and upcoming buckets", () => {
    const now = new Date("2026-08-27T09:00:00.000Z")
    const tomorrow = new Date("2026-08-28T00:00:00.000Z")
    expect(salesTaskBucket(new Date("2026-08-27T08:59:00.000Z"), now, tomorrow)).toBe("overdue")
    expect(salesTaskBucket(new Date("2026-08-27T12:00:00.000Z"), now, tomorrow)).toBe("today")
    expect(salesTaskBucket(new Date("2026-08-28T12:00:00.000Z"), now, tomorrow)).toBe("upcoming")
  })
})
