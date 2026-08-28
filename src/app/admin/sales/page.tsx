import { prisma } from "@/lib/db"
import { canAccessSales, getSalesAccess, salesLeadScope } from "@/lib/sales/access"
import { istanbulDayBounds } from "@/lib/sales/time"
import { SalesConsole } from "./sales-console"

export const dynamic = "force-dynamic"

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string | string[] }>
}) {
  const access = await getSalesAccess()
  const canManagePipeline = canAccessSales(access, "manageSalesPipeline")
  const sp = await searchParams
  const initialLeadId = typeof sp.lead === "string" ? sp.lead : null
  const now = new Date()
  const { end: tomorrow } = istanbulDayBounds(now)

  const leads = await prisma.salesLead.findMany({
    where: salesLeadScope(access),
    orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      businessName: true,
      contactName: true,
      phone: true,
      email: true,
      city: true,
      district: true,
      address: true,
      monthlyVehicles: true,
      notes: true,
      status: true,
      source: true,
      nextActionAt: true,
      createdAt: true,
      workshopId: true,
      advisorId: true,
      advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 5,
        select: { id: true, type: true, summary: true, occurredAt: true },
      },
    },
  })

  const tasks = await prisma.salesTask.findMany({
    where: {
      status: "scheduled",
      startsAt: { lt: tomorrow },
      ...(access.kind === "advisor" ? { lead: { advisorId: access.advisorId } } : {}),
    },
    orderBy: { startsAt: "asc" },
    take: 100,
    select: {
      id: true,
      type: true,
      startsAt: true,
      durationMinutes: true,
      note: true,
      lead: {
        select: {
          id: true,
          businessName: true,
          contactName: true,
          advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
      },
    },
  })

  const discountCodes = await prisma.salesDiscountCode.findMany({
    where: salesLeadScope(access) ? { advisorId: access.advisorId! } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, code: true, discountPercent: true, fundingSource: true, usedCount: true, maxUses: true,
      expiresAt: true, disabledAt: true, usedAt: true, createdAt: true,
      lead: { select: { businessName: true } },
      advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      createdBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  const advisors = access.kind === "admin"
    ? await prisma.salesAdvisor.findMany({
        where: { disabledAt: null },
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      })
    : []

  const serializedLeads = leads.map((lead) => ({
    ...lead,
    advisorName: lead.advisor
      ? [lead.advisor.user.firstName, lead.advisor.user.lastName].filter(Boolean).join(" ") || lead.advisor.user.email
      : null,
    nextActionAt: lead.nextActionAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    activities: lead.activities.map((a) => ({ ...a, occurredAt: a.occurredAt.toISOString() })),
  }))

  const serializedDiscountCodes = discountCodes.map((dc) => ({
    ...dc,
    expiresAt: dc.expiresAt.toISOString(),
    disabledAt: dc.disabledAt?.toISOString() ?? null,
    usedAt: dc.usedAt?.toISOString() ?? null,
    createdAt: dc.createdAt.toISOString(),
    leadName: dc.lead?.businessName ?? null,
    advisorName: dc.advisor
      ? [dc.advisor.user.firstName, dc.advisor.user.lastName].filter(Boolean).join(" ") || dc.advisor.user.email
      : null,
    createdByName: dc.createdBy
      ? [dc.createdBy.firstName, dc.createdBy.lastName].filter(Boolean).join(" ") || dc.createdBy.email
      : null,
  }))

  return (
    <div className="space-y-6">
      <SalesConsole
        isAdmin={access.kind === "admin"}
        canManagePipeline={canManagePipeline}
        initialLeadId={initialLeadId}
        leads={serializedLeads}
        tasks={tasks.map((task) => ({
          id: task.id,
          type: task.type,
          startsAt: task.startsAt.toISOString(),
          durationMinutes: task.durationMinutes,
          note: task.note,
          overdue: task.startsAt < now,
          lead: {
            id: task.lead.id,
            businessName: task.lead.businessName,
            contactName: task.lead.contactName,
          },
          advisorName: task.lead.advisor
            ? [task.lead.advisor.user.firstName, task.lead.advisor.user.lastName].filter(Boolean).join(" ") || task.lead.advisor.user.email
            : null,
        }))}
        discountCodes={serializedDiscountCodes}
        advisors={advisors.map((a) => ({
          id: a.id,
          name: [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") || a.user.email || "—",
        }))}
      />
    </div>
  )
}
