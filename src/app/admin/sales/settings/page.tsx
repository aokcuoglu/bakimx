import Link from "next/link"
import { ArrowLeft, Settings2 } from "lucide-react"
import { prisma } from "@/lib/db"
import { getSalesAccess } from "@/lib/sales/access"
import { Button } from "@/components/ui/button"
import { CommissionRuleSettings } from "@/components/sales/commission-rule-settings"

export const dynamic = "force-dynamic"

export default async function SalesCommissionSettingsPage() {
  await getSalesAccess("manageSalesCommissions")
  const renderedAt = new Date().getTime()
  const rules = await prisma.salesCommissionRule.findMany({
    orderBy: [{ planTier: "asc" }, { billingCycle: "asc" }, { effectiveFrom: "desc" }],
    select: {
      id: true,
      planTier: true,
      billingCycle: true,
      rateBps: true,
      effectiveFrom: true,
      effectiveTo: true,
      createdAt: true,
      createdBy: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link href="/admin/sales/commissions"><ArrowLeft className="size-4" /> Hakedişlere dön</Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Settings2 className="size-6 text-primary" /> Hakediş kuralları
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Paket ve faturalama dönemi için yürürlük tarihli yüzde geçmişi.</p>
      </div>
      <CommissionRuleSettings
        now={renderedAt}
        rules={rules.map((rule) => ({
          ...rule,
          effectiveFrom: rule.effectiveFrom.toISOString(),
          effectiveTo: rule.effectiveTo?.toISOString() ?? null,
          createdAt: rule.createdAt.toISOString(),
          createdByName: [rule.createdBy.firstName, rule.createdBy.lastName].filter(Boolean).join(" ") || rule.createdBy.email || "—",
        }))}
      />
    </div>
  )
}
