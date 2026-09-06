import "server-only"

import { prisma } from "@/lib/db"
import { canAccessSales, type SalesAccess } from "@/lib/sales/access"
import { istanbulMonthBounds } from "@/lib/sales/time"
import {
  aggregateSalesPerformance,
  buildSalesPerformanceRows,
  type SalesAdvisorPerformance,
  type SalesPerformanceSource,
} from "@/lib/sales/performance"

export type SalesPerformanceReport = {
  period: {
    key: string
    label: string
    previousKey: string
    nextKey: string
    startIso: string
    endIso: string
  }
  isAdvisor: boolean
  canManageTargets: boolean
  selectedAdvisorId: string | null
  advisors: { id: string; name: string }[]
  rows: SalesAdvisorPerformance[]
  summary: SalesAdvisorPerformance
}

export async function loadSalesPerformance(
  access: SalesAccess,
  options: { month?: string | null; advisorId?: string | null; now?: Date } = {},
): Promise<SalesPerformanceReport> {
  const now = options.now ?? new Date()
  const bounds = istanbulMonthBounds(options.month, now)
  const availableAdvisors = await prisma.salesAdvisor.findMany({
    where: access.kind === "advisor" ? { id: access.advisorId, disabledAt: null } : { disabledAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  })
  const advisorOptions = availableAdvisors.map((advisor) => ({
    id: advisor.id,
    name: [advisor.user.firstName, advisor.user.lastName].filter(Boolean).join(" ") || advisor.user.email || "—",
  }))
  const requestedAdvisorId = access.kind === "advisor" ? access.advisorId : options.advisorId
  const selectedAdvisorId = requestedAdvisorId && advisorOptions.some((advisor) => advisor.id === requestedAdvisorId)
    ? requestedAdvisorId
    : null
  const scopedAdvisors = selectedAdvisorId
    ? advisorOptions.filter((advisor) => advisor.id === selectedAdvisorId)
    : advisorOptions
  const advisorIds = scopedAdvisors.map((advisor) => advisor.id)
  const range = { gte: bounds.start, lt: bounds.end }

  const [targets, leads, currentLeads, activities, conversions, commissions, overdueTasks] = await Promise.all([
    prisma.salesAdvisorMonthlyTarget.findMany({
      where: { advisorId: { in: advisorIds }, monthStart: bounds.start },
      select: {
        advisorId: true,
        newLeadTarget: true,
        qualifiedInteractionTarget: true,
        completedDemoTarget: true,
        wonWorkshopTarget: true,
        netSalesTargetMinor: true,
      },
    }),
    prisma.salesLead.findMany({
      where: { advisorId: { in: advisorIds }, createdAt: range },
      select: { advisorId: true, createdAt: true },
    }),
    prisma.salesLead.findMany({
      where: { advisorId: { in: advisorIds } },
      select: { advisorId: true, status: true },
    }),
    prisma.salesActivity.findMany({
      where: {
        occurredAt: range,
        OR: [
          { lead: { advisorId: { in: advisorIds } } },
          { createdBy: { salesAdvisor: { id: { in: advisorIds } } } },
        ],
      },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
      select: {
        leadId: true,
        type: true,
        result: true,
        occurredAt: true,
        lead: { select: { advisorId: true } },
        createdBy: { select: { salesAdvisor: { select: { id: true } } } },
      },
    }),
    prisma.salesRegistrationLink.findMany({
      where: {
        advisorId: { in: advisorIds },
        usedAt: range,
        workshopId: { not: null },
      },
      select: { advisorId: true, leadId: true, usedAt: true },
    }),
    prisma.salesCommission.findMany({
      where: {
        advisorId: { in: advisorIds },
        billingOrder: { confirmedAt: range },
      },
      select: {
        advisorId: true,
        status: true,
        calculationBaseMinor: true,
        calculatedAmountMinor: true,
        approvedAmountMinor: true,
        billingOrder: { select: { confirmedAt: true } },
      },
    }),
    prisma.salesTask.findMany({
      where: {
        status: "scheduled",
        startsAt: { lt: now },
        lead: { advisorId: { in: advisorIds } },
      },
      select: { lead: { select: { advisorId: true } } },
    }),
  ])

  const source: SalesPerformanceSource = {
    advisors: scopedAdvisors,
    targets: targets.map((target) => ({
      advisorId: target.advisorId,
      newLeads: target.newLeadTarget,
      qualifiedInteractions: target.qualifiedInteractionTarget,
      completedDemos: target.completedDemoTarget,
      wonWorkshops: target.wonWorkshopTarget,
      netSalesMinor: target.netSalesTargetMinor,
    })),
    leads,
    currentLeads,
    activities: activities.map((activity) => ({
      actorAdvisorId: activity.createdBy.salesAdvisor?.id ?? null,
      leadAdvisorId: activity.lead.advisorId,
      leadId: activity.leadId,
      type: activity.type,
      result: activity.result,
      occurredAt: activity.occurredAt,
    })),
    conversions: conversions.flatMap((conversion) => conversion.usedAt ? [{
      advisorId: conversion.advisorId,
      leadId: conversion.leadId,
      occurredAt: conversion.usedAt,
    }] : []),
    commissions: commissions.flatMap((commission) => commission.billingOrder.confirmedAt ? [{
      advisorId: commission.advisorId,
      status: commission.status,
      calculationBaseMinor: commission.calculationBaseMinor,
      calculatedAmountMinor: commission.calculatedAmountMinor,
      approvedAmountMinor: commission.approvedAmountMinor,
      confirmedAt: commission.billingOrder.confirmedAt,
    }] : []),
    overdueTasks: overdueTasks.map((task) => ({ advisorId: task.lead.advisorId })),
    period: {
      key: bounds.key,
      label: bounds.label,
      start: bounds.start,
      dayCount: bounds.dayCount,
    },
  }
  const rows = buildSalesPerformanceRows(source)

  return {
    period: {
      key: bounds.key,
      label: bounds.label,
      previousKey: bounds.previousKey,
      nextKey: bounds.nextKey,
      startIso: bounds.start.toISOString(),
      endIso: bounds.end.toISOString(),
    },
    isAdvisor: access.kind === "advisor",
    canManageTargets: canAccessSales(access, "manageSalesAdvisors"),
    selectedAdvisorId,
    advisors: advisorOptions,
    rows,
    summary: aggregateSalesPerformance(rows, source.period),
  }
}
