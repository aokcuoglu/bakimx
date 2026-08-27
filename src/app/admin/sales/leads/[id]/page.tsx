import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { canAccessSales, getSalesAccess, salesLeadScope } from "@/lib/sales/access"
import { salesAdvisorDisplayName } from "@/lib/sales/links"
import { SalesLeadDetail } from "@/components/sales/sales-lead-detail"

export const dynamic = "force-dynamic"

const ACTIVITY_PAGE_SIZE = 10

function personName(user: { firstName: string | null; lastName: string | null; email: string | null }) {
  return salesAdvisorDisplayName(user) ?? "—"
}

export default async function SalesLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string | string[]; task?: string | string[] }>
}) {
  const access = await getSalesAccess()
  const canManage = canAccessSales(access, "manageSalesPipeline")
  const { id } = await params
  const query = await searchParams
  const requestedPage = typeof query.page === "string" ? Number.parseInt(query.page, 10) : 1
  const activityPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const requestedTaskId = typeof query.task === "string" ? query.task : null

  const lead = await prisma.salesLead.findFirst({
    where: { id, ...salesLeadScope(access) },
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
      source: true,
      status: true,
      lostReason: true,
      nextActionAt: true,
      attributionFrozenAt: true,
      workshopId: true,
      advisorId: true,
      createdAt: true,
      advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      tasks: {
        orderBy: [{ status: "asc" }, { startsAt: "desc" }],
        take: 100,
        select: {
          id: true,
          type: true,
          startsAt: true,
          durationMinutes: true,
          status: true,
          note: true,
          resolvedAt: true,
          completedByActivityId: true,
          createdBy: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      assignments: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          createdAt: true,
          fromAdvisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
          toAdvisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
          actor: { select: { firstName: true, lastName: true, email: true } },
        },
      },
      _count: { select: { activities: true } },
    },
  })
  if (!lead) notFound()

  const activityPages = Math.max(1, Math.ceil(lead._count.activities / ACTIVITY_PAGE_SIZE))
  const currentActivityPage = Math.min(activityPage, activityPages)
  const [activities, advisors] = await Promise.all([
    prisma.salesActivity.findMany({
      where: { leadId: lead.id },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      skip: (currentActivityPage - 1) * ACTIVITY_PAGE_SIZE,
      take: ACTIVITY_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        result: true,
        summary: true,
        lostReason: true,
        occurredAt: true,
        nextActionAt: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    access.kind === "admin" && canManage
      ? prisma.salesAdvisor.findMany({
          where: { disabledAt: null, user: { isActive: true } },
          orderBy: { createdAt: "asc" },
          select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } },
        })
      : Promise.resolve([]),
  ])

  const initialTaskId = requestedTaskId && lead.tasks.some((task) => task.id === requestedTaskId && task.status === "scheduled")
    ? requestedTaskId
    : null

  return (
    <SalesLeadDetail
      canManage={canManage}
      isAdmin={access.kind === "admin"}
      initialTaskId={initialTaskId}
      activityPage={currentActivityPage}
      activityPages={activityPages}
      advisors={advisors.map((advisor) => ({ id: advisor.id, name: personName(advisor.user) }))}
      lead={{
        id: lead.id,
        businessName: lead.businessName,
        contactName: lead.contactName,
        phone: lead.phone,
        email: lead.email,
        city: lead.city,
        district: lead.district,
        address: lead.address,
        monthlyVehicles: lead.monthlyVehicles,
        notes: lead.notes,
        source: lead.source,
        status: lead.status,
        lostReason: lead.lostReason,
        nextActionAt: lead.nextActionAt?.toISOString() ?? null,
        attributionFrozenAt: lead.attributionFrozenAt?.toISOString() ?? null,
        workshopId: lead.workshopId,
        advisorId: lead.advisorId,
        advisorName: lead.advisor ? personName(lead.advisor.user) : null,
        createdAt: lead.createdAt.toISOString(),
        tasks: lead.tasks.map((task) => ({
          id: task.id,
          type: task.type,
          startsAt: task.startsAt.toISOString(),
          durationMinutes: task.durationMinutes,
          status: task.status,
          note: task.note,
          resolvedAt: task.resolvedAt?.toISOString() ?? null,
          completedByActivityId: task.completedByActivityId,
          createdByName: personName(task.createdBy),
        })),
        assignments: lead.assignments.map((assignment) => ({
          id: assignment.id,
          fromAdvisorName: assignment.fromAdvisor ? personName(assignment.fromAdvisor.user) : null,
          toAdvisorName: assignment.toAdvisor ? personName(assignment.toAdvisor.user) : null,
          actorName: personName(assignment.actor),
          createdAt: assignment.createdAt.toISOString(),
        })),
        activities: activities.map((activity) => ({
          id: activity.id,
          type: activity.type,
          result: activity.result,
          summary: activity.summary,
          lostReason: activity.lostReason,
          occurredAt: activity.occurredAt.toISOString(),
          nextActionAt: activity.nextActionAt?.toISOString() ?? null,
          createdByName: personName(activity.createdBy),
        })),
      }}
    />
  )
}
