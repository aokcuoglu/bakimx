import { SalesAdvisorManagement } from "@/components/sales/sales-advisor-management"
import { prisma } from "@/lib/db"
import { getSalesAccess } from "@/lib/sales/access"

export const dynamic = "force-dynamic"

export default async function SalesAdvisorsPage() {
  await getSalesAccess("manageSalesAdvisors")
  const [advisors, invites] = await Promise.all([
    prisma.salesAdvisor.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        disabledAt: true,
        createdAt: true,
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
    prisma.salesAdvisorInvite.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Satış Danışmanları</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Davet, erişim ve oturum güvenliğini yönetin.</p>
      </div>
      <SalesAdvisorManagement
        advisors={advisors.map((advisor) => ({
          id: advisor.id,
          name: [advisor.user.firstName, advisor.user.lastName].filter(Boolean).join(" ") || advisor.user.email || "—",
          email: advisor.user.email ?? "—",
          disabledAt: advisor.disabledAt?.toISOString() ?? null,
          createdAt: advisor.createdAt.toISOString(),
        }))}
        invites={invites.map((invite) => ({
          id: invite.id,
          name: `${invite.firstName} ${invite.lastName}`,
          email: invite.email,
          status: invite.status,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
