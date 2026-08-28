import { expect, test } from "bun:test"
import { aggregateSalesPerformance, buildSalesPerformanceRows, type SalesPerformanceSource } from "./performance"
import { salesMonthlyTargetSchema } from "@/lib/validations/sales"

const period = {
  key: "2026-08",
  label: "Ağustos 2026",
  start: new Date("2026-07-31T21:00:00.000Z"),
  dayCount: 31,
}

test("aylık hedef, nitelikli görüşme, demo, kapanış ve ledger snapshot metriklerini hesaplar", () => {
  const source: SalesPerformanceSource = {
    period,
    advisors: [{ id: "advisor-1", name: "Ada Satış" }],
    targets: [{
      advisorId: "advisor-1",
      newLeads: 10,
      qualifiedInteractions: 12,
      completedDemos: 3,
      wonWorkshops: 2,
      netSalesMinor: 100_000,
    }],
    leads: [
      { advisorId: "advisor-1", createdAt: new Date("2026-08-02T09:00:00.000Z") },
      { advisorId: "advisor-1", createdAt: new Date("2026-08-10T09:00:00.000Z") },
    ],
    currentLeads: [
      { advisorId: "advisor-1", status: "proposal" },
      { advisorId: "advisor-1", status: "won" },
    ],
    activities: [
      { actorAdvisorId: "advisor-1", leadAdvisorId: "advisor-1", leadId: "lead-1", type: "note", result: null, occurredAt: new Date("2026-08-02T10:00:00.000Z") },
      { actorAdvisorId: "advisor-1", leadAdvisorId: "advisor-1", leadId: "lead-1", type: "phone", result: "won", occurredAt: new Date("2026-08-03T10:00:00.000Z") },
      { actorAdvisorId: "advisor-1", leadAdvisorId: "advisor-1", leadId: "lead-2", type: "demo", result: "lost", occurredAt: new Date("2026-08-11T10:00:00.000Z") },
      { actorAdvisorId: "advisor-1", leadAdvisorId: "advisor-1", leadId: "lead-2", type: "email", result: "won", occurredAt: new Date("2026-08-12T10:00:00.000Z") },
    ],
    conversions: [{ advisorId: "advisor-1", leadId: "lead-1", occurredAt: new Date("2026-08-03T10:00:00.000Z") }],
    commissions: [
      { advisorId: "advisor-1", status: "paid", calculationBaseMinor: 83_333, calculatedAmountMinor: 8_333, approvedAmountMinor: 8_000, confirmedAt: new Date("2026-08-04T10:00:00.000Z") },
      { advisorId: "advisor-1", status: "void", calculationBaseMinor: 16_667, calculatedAmountMinor: 1_667, approvedAmountMinor: null, confirmedAt: new Date("2026-08-20T10:00:00.000Z") },
    ],
    overdueTasks: [{ advisorId: "advisor-1" }],
  }

  const [row] = buildSalesPerformanceRows(source)
  expect(row.target.netSalesMinor).toBe(100_000)
  expect(row.actual).toMatchObject({
    newLeads: 2,
    qualifiedInteractions: 3,
    completedDemos: 1,
    wonWorkshops: 1,
    netSalesMinor: 100_000,
    closedWon: 2,
    closedLost: 0,
    closingRate: 100,
    overdueTasks: 1,
  })
  expect(row.commissions).toEqual({ calculatedMinor: 8_333, approvedMinor: 8_000, paidMinor: 8_000 })
  expect(row.funnel.proposal).toBe(1)
  expect(row.trend[0]).toMatchObject({ newLeads: 1, qualifiedInteractions: 1, wonWorkshops: 1, netSalesMinor: 83_333 })
  expect(row.trend[1]).toMatchObject({ newLeads: 1, qualifiedInteractions: 2 })
})

test("ekip kapanış oranını kişi yüzdelerini ortalamadan won / (won + lost) olarak hesaplar", () => {
  const rows = buildSalesPerformanceRows({
    period,
    advisors: [{ id: "a", name: "A" }, { id: "b", name: "B" }],
    targets: [],
    leads: [],
    currentLeads: [],
    activities: [
      { actorAdvisorId: "a", leadAdvisorId: "a", leadId: "1", type: "phone", result: "won", occurredAt: new Date("2026-08-02T00:00:00Z") },
      { actorAdvisorId: "b", leadAdvisorId: "b", leadId: "2", type: "phone", result: "lost", occurredAt: new Date("2026-08-03T00:00:00Z") },
      { actorAdvisorId: "b", leadAdvisorId: "b", leadId: "3", type: "phone", result: "lost", occurredAt: new Date("2026-08-04T00:00:00Z") },
    ],
    conversions: [],
    commissions: [],
    overdueTasks: [],
  })
  const team = aggregateSalesPerformance(rows, period)
  expect(team.actual.closedWon).toBe(1)
  expect(team.actual.closedLost).toBe(2)
  expect(team.actual.closingRate).toBe(33.33)
})

test("danışman kapsamı dışındaki kayıtlar kişinin metriğine sızmaz", () => {
  const [row] = buildSalesPerformanceRows({
    period,
    advisors: [{ id: "a", name: "A" }],
    targets: [],
    leads: [{ advisorId: "b", createdAt: new Date("2026-08-02T00:00:00Z") }],
    currentLeads: [{ advisorId: "b", status: "won" }],
    activities: [{ actorAdvisorId: "b", leadAdvisorId: "b", leadId: "x", type: "demo", result: "won", occurredAt: new Date("2026-08-02T00:00:00Z") }],
    conversions: [{ advisorId: "b", leadId: "x", occurredAt: new Date("2026-08-02T00:00:00Z") }],
    commissions: [{ advisorId: "b", status: "paid", calculationBaseMinor: 10_000, calculatedAmountMinor: 1_000, approvedAmountMinor: 1_000, confirmedAt: new Date("2026-08-02T00:00:00Z") }],
    overdueTasks: [{ advisorId: "b" }],
  })
  expect(row.actual).toEqual({
    newLeads: 0,
    qualifiedInteractions: 0,
    completedDemos: 0,
    wonWorkshops: 0,
    netSalesMinor: 0,
    closedWon: 0,
    closedLost: 0,
    closingRate: null,
    overdueTasks: 0,
  })
})

test("aylık hedef girdisi negatif, kesirli adet ve kuruştan küçük net satışı reddeder", () => {
  const valid = {
    advisorId: "advisor-1",
    month: "2026-08",
    newLeadTarget: 10,
    qualifiedInteractionTarget: 20,
    completedDemoTarget: 4,
    wonWorkshopTarget: 2,
    netSalesTarget: 125_000.25,
  }
  expect(salesMonthlyTargetSchema.safeParse(valid).success).toBe(true)
  expect(salesMonthlyTargetSchema.safeParse({ ...valid, newLeadTarget: 1.5 }).success).toBe(false)
  expect(salesMonthlyTargetSchema.safeParse({ ...valid, wonWorkshopTarget: -1 }).success).toBe(false)
  expect(salesMonthlyTargetSchema.safeParse({ ...valid, netSalesTarget: 12.345 }).success).toBe(false)
  expect(salesMonthlyTargetSchema.safeParse({ ...valid, month: "2026-13" }).success).toBe(false)
})

test("görüşmeyi aktöre, kapanışı adayın güncel danışmanına yazar", () => {
  const rows = buildSalesPerformanceRows({
    period,
    advisors: [{ id: "actor", name: "Aktör" }, { id: "owner", name: "Aday sahibi" }],
    targets: [],
    leads: [],
    currentLeads: [],
    activities: [{
      actorAdvisorId: "actor",
      leadAdvisorId: "owner",
      leadId: "transferred-lead",
      type: "phone",
      result: "lost",
      occurredAt: new Date("2026-08-05T10:00:00Z"),
    }],
    conversions: [],
    commissions: [],
    overdueTasks: [],
  })
  expect(rows[0].actual.qualifiedInteractions).toBe(1)
  expect(rows[0].actual.closedLost).toBe(0)
  expect(rows[1].actual.qualifiedInteractions).toBe(0)
  expect(rows[1].actual.closedLost).toBe(1)
})
