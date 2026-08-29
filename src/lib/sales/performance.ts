export const SALES_FUNNEL_STATUSES = [
  "new",
  "contacted",
  "demo_scheduled",
  "demo_completed",
  "proposal",
  "onboarding",
  "won",
  "lost",
] as const

export type SalesFunnelStatus = typeof SALES_FUNNEL_STATUSES[number]

export type SalesPerformanceTarget = {
  newLeads: number
  qualifiedInteractions: number
  completedDemos: number
  wonWorkshops: number
  netSalesMinor: number
}

export type SalesPerformanceActual = SalesPerformanceTarget & {
  closedWon: number
  closedLost: number
  closingRate: number | null
  overdueTasks: number
}

export type SalesCommissionTotals = {
  calculatedMinor: number
  approvedMinor: number
  paidMinor: number
}

export type SalesTrendBucket = {
  key: string
  label: string
  newLeads: number
  qualifiedInteractions: number
  wonWorkshops: number
  netSalesMinor: number
}

export type SalesAdvisorPerformance = {
  advisorId: string
  name: string
  target: SalesPerformanceTarget
  actual: SalesPerformanceActual
  commissions: SalesCommissionTotals
  funnel: Record<SalesFunnelStatus, number>
  trend: SalesTrendBucket[]
}

export type SalesPerformanceSource = {
  advisors: { id: string; name: string }[]
  targets: ({ advisorId: string } & SalesPerformanceTarget)[]
  leads: { advisorId: string | null; createdAt: Date }[]
  currentLeads: { advisorId: string | null; status: SalesFunnelStatus }[]
  activities: {
    actorAdvisorId: string | null
    leadAdvisorId: string | null
    leadId: string
    type: "visit" | "phone" | "whatsapp" | "email" | "demo" | "note"
    result: "won" | "lost" | string | null
    occurredAt: Date
  }[]
  conversions: { advisorId: string; leadId: string; occurredAt: Date }[]
  commissions: {
    advisorId: string
    status: "draft" | "approved" | "paid" | "void"
    calculationBaseMinor: number | null
    calculatedAmountMinor: number | null
    approvedAmountMinor: number | null
    confirmedAt: Date
  }[]
  overdueTasks: { advisorId: string | null }[]
  period: { key: string; label: string; start: Date; dayCount: number }
}

const QUALIFIED_TYPES = new Set(["visit", "phone", "whatsapp", "email", "demo"])

function emptyTarget(): SalesPerformanceTarget {
  return { newLeads: 0, qualifiedInteractions: 0, completedDemos: 0, wonWorkshops: 0, netSalesMinor: 0 }
}

function emptyActual(): SalesPerformanceActual {
  return { ...emptyTarget(), closedWon: 0, closedLost: 0, closingRate: null, overdueTasks: 0 }
}

function emptyCommissions(): SalesCommissionTotals {
  return { calculatedMinor: 0, approvedMinor: 0, paidMinor: 0 }
}

function emptyFunnel(): Record<SalesFunnelStatus, number> {
  return Object.fromEntries(SALES_FUNNEL_STATUSES.map((status) => [status, 0])) as Record<SalesFunnelStatus, number>
}

function trendBuckets(period: SalesPerformanceSource["period"]): SalesTrendBucket[] {
  const buckets: SalesTrendBucket[] = []
  for (let firstDay = 1; firstDay <= period.dayCount; firstDay += 7) {
    const lastDay = Math.min(firstDay + 6, period.dayCount)
    buckets.push({
      key: `${period.key}-${String(firstDay).padStart(2, "0")}`,
      label: `${firstDay}–${lastDay}`,
      newLeads: 0,
      qualifiedInteractions: 0,
      wonWorkshops: 0,
      netSalesMinor: 0,
    })
  }
  return buckets
}

function bucketIndex(date: Date, start: Date, bucketCount: number): number {
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000)
  return Math.min(bucketCount - 1, Math.max(0, Math.floor(day / 7)))
}

function sumTargets(targets: SalesPerformanceTarget[]): SalesPerformanceTarget {
  return targets.reduce((sum, row) => ({
    newLeads: sum.newLeads + row.newLeads,
    qualifiedInteractions: sum.qualifiedInteractions + row.qualifiedInteractions,
    completedDemos: sum.completedDemos + row.completedDemos,
    wonWorkshops: sum.wonWorkshops + row.wonWorkshops,
    netSalesMinor: sum.netSalesMinor + row.netSalesMinor,
  }), emptyTarget())
}

/** DB sorgularını salt metrik hesabından ayırır; rol kapsamı query katmanında
 * kurulurken kapanış ve ledger matematiği burada deterministik kalır. */
export function buildSalesPerformanceRows(source: SalesPerformanceSource): SalesAdvisorPerformance[] {
  const targetByAdvisor = new Map(source.targets.map((target) => [target.advisorId, target]))

  return source.advisors.map((advisor) => {
    const target = targetByAdvisor.get(advisor.id) ?? { advisorId: advisor.id, ...emptyTarget() }
    const actual = emptyActual()
    const commissions = emptyCommissions()
    const funnel = emptyFunnel()
    const trend = trendBuckets(source.period)

    for (const lead of source.leads) {
      if (lead.advisorId !== advisor.id) continue
      actual.newLeads += 1
      trend[bucketIndex(lead.createdAt, source.period.start, trend.length)].newLeads += 1
    }

    const latestTerminalByLead = new Map<string, { result: "won" | "lost"; occurredAt: Date }>()
    for (const activity of source.activities) {
      const bucket = trend[bucketIndex(activity.occurredAt, source.period.start, trend.length)]
      if (activity.actorAdvisorId === advisor.id && QUALIFIED_TYPES.has(activity.type)) {
        actual.qualifiedInteractions += 1
        bucket.qualifiedInteractions += 1
      }
      if (activity.actorAdvisorId === advisor.id && activity.type === "demo") actual.completedDemos += 1
      if (activity.leadAdvisorId === advisor.id && (activity.result === "won" || activity.result === "lost")) {
        const previous = latestTerminalByLead.get(activity.leadId)
        if (!previous || activity.occurredAt > previous.occurredAt) {
          latestTerminalByLead.set(activity.leadId, { result: activity.result, occurredAt: activity.occurredAt })
        }
      }
    }
    for (const terminal of latestTerminalByLead.values()) {
      if (terminal.result === "won") actual.closedWon += 1
      else actual.closedLost += 1
    }
    const closed = actual.closedWon + actual.closedLost
    actual.closingRate = closed === 0 ? null : Math.round((actual.closedWon / closed) * 10_000) / 100

    const convertedLeadIds = new Set<string>()
    for (const conversion of source.conversions) {
      if (conversion.advisorId !== advisor.id || convertedLeadIds.has(conversion.leadId)) continue
      convertedLeadIds.add(conversion.leadId)
      actual.wonWorkshops += 1
      trend[bucketIndex(conversion.occurredAt, source.period.start, trend.length)].wonWorkshops += 1
    }

    for (const commission of source.commissions) {
      if (commission.advisorId !== advisor.id) continue
      const base = commission.calculationBaseMinor ?? 0
      actual.netSalesMinor += base
      trend[bucketIndex(commission.confirmedAt, source.period.start, trend.length)].netSalesMinor += base
      if (commission.status !== "void") commissions.calculatedMinor += commission.calculatedAmountMinor ?? 0
      if (commission.status === "approved" || commission.status === "paid") {
        commissions.approvedMinor += commission.approvedAmountMinor ?? 0
      }
      if (commission.status === "paid") commissions.paidMinor += commission.approvedAmountMinor ?? 0
    }

    for (const lead of source.currentLeads) {
      if (lead.advisorId === advisor.id) funnel[lead.status] += 1
    }
    actual.overdueTasks = source.overdueTasks.filter((task) => task.advisorId === advisor.id).length

    return {
      advisorId: advisor.id,
      name: advisor.name,
      target: {
        newLeads: target.newLeads,
        qualifiedInteractions: target.qualifiedInteractions,
        completedDemos: target.completedDemos,
        wonWorkshops: target.wonWorkshops,
        netSalesMinor: target.netSalesMinor,
      },
      actual,
      commissions,
      funnel,
      trend,
    }
  })
}

export function aggregateSalesPerformance(rows: SalesAdvisorPerformance[], period: SalesPerformanceSource["period"]): SalesAdvisorPerformance {
  const aggregate: SalesAdvisorPerformance = {
    advisorId: "team",
    name: "Ekip toplamı",
    target: sumTargets(rows.map((row) => row.target)),
    actual: emptyActual(),
    commissions: emptyCommissions(),
    funnel: emptyFunnel(),
    trend: trendBuckets(period),
  }
  for (const row of rows) {
    aggregate.actual.newLeads += row.actual.newLeads
    aggregate.actual.qualifiedInteractions += row.actual.qualifiedInteractions
    aggregate.actual.completedDemos += row.actual.completedDemos
    aggregate.actual.wonWorkshops += row.actual.wonWorkshops
    aggregate.actual.netSalesMinor += row.actual.netSalesMinor
    aggregate.actual.closedWon += row.actual.closedWon
    aggregate.actual.closedLost += row.actual.closedLost
    aggregate.actual.overdueTasks += row.actual.overdueTasks
    aggregate.commissions.calculatedMinor += row.commissions.calculatedMinor
    aggregate.commissions.approvedMinor += row.commissions.approvedMinor
    aggregate.commissions.paidMinor += row.commissions.paidMinor
    for (const status of SALES_FUNNEL_STATUSES) aggregate.funnel[status] += row.funnel[status]
    row.trend.forEach((bucket, index) => {
      aggregate.trend[index].newLeads += bucket.newLeads
      aggregate.trend[index].qualifiedInteractions += bucket.qualifiedInteractions
      aggregate.trend[index].wonWorkshops += bucket.wonWorkshops
      aggregate.trend[index].netSalesMinor += bucket.netSalesMinor
    })
  }
  const closed = aggregate.actual.closedWon + aggregate.actual.closedLost
  aggregate.actual.closingRate = closed === 0 ? null : Math.round((aggregate.actual.closedWon / closed) * 10_000) / 100
  return aggregate
}
