import { prisma } from "@/lib/db"
import { canAccessSales, getSalesAccess, salesLeadScope } from "@/lib/sales/access"
import { SalesConsole } from "./sales-console"

export const dynamic = "force-dynamic"

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string | string[] }>
}) {
  const access = await getSalesAccess()
  const canManagePipeline = canAccessSales(access, "manageSalesPipeline")
  const canManageCommissions = canAccessSales(access, "manageSalesCommissions")
  const sp = await searchParams
  const initialLeadId = typeof sp.lead === "string" ? sp.lead : null

  const leads = await prisma.salesLead.findMany({
    where: salesLeadScope(access),
    orderBy: [{ nextActionAt: "asc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      businessName: true,
      contactName: true,
      phone: true,
      city: true,
      notes: true,
      status: true,
      source: true,
      nextActionAt: true,
      createdAt: true,
      workshopId: true,
      advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 5,
        select: { id: true, type: true, summary: true, occurredAt: true },
      },
    },
  })

  const commissions = canManageCommissions
    ? await prisma.salesCommission.findMany({
        where: { status: { in: ["draft", "approved"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, status: true, amountMinor: true, note: true,
          lead: { select: { businessName: true } },
          advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        },
      })
    : []

  const discountCodes = await prisma.salesDiscountCode.findMany({
    where: salesLeadScope(access) ? { advisorId: access.advisorId! } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, code: true, discountPercent: true, usedCount: true, maxUses: true,
      expiresAt: true, disabledAt: true, usedAt: true, createdAt: true,
      lead: { select: { businessName: true } },
      advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
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
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Satış Danışman Paneli</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Servis adayları, görüşmeler ve dönüşüm takibi.</p>
      </div>
      <SalesConsole
        isAdmin={access.kind === "admin"}
        canManagePipeline={canManagePipeline}
        canManageCommissions={canManageCommissions}
        initialLeadId={initialLeadId}
        leads={serializedLeads}
        commissions={commissions.map((c) => ({
          id: c.id, status: c.status, amountMinor: c.amountMinor, note: c.note,
          businessName: c.lead.businessName,
          advisorName: [c.advisor.user.firstName, c.advisor.user.lastName].filter(Boolean).join(" ") || c.advisor.user.email || "—",
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
