import Link from "next/link"
import { Clock, Sparkles, PhoneIncoming, LifeBuoy, Building2, Landmark, ArrowRight } from "lucide-react"
import { requireAdmin } from "@/lib/admin"
import { getWorkshopRows, getLeadRows, getBillingData } from "@/app/admin/data"
import { HealthBand } from "@/app/admin/health/health-band"

export const dynamic = "force-dynamic"

export default async function AdminHomePage() {
  await requireAdmin()

  const [rows, leads, billing] = await Promise.all([
    getWorkshopRows(),
    getLeadRows(),
    getBillingData(),
  ])

  const pending = rows.filter((r) => r.approvalStatus === "pending")
  const requestCount = rows.filter((r) => r.requestedPlanTier).length
  const newDemoCount = leads.demoRows.filter((r) => r.status === "new").length
  const newSupportCount = leads.supportRows.filter((r) => r.status === "new").length

  const counters = [
    { icon: Clock, value: pending.length, label: "onay bekliyor", href: "/admin/workshops", tone: "text-amber-600" },
    { icon: Sparkles, value: requestCount, label: "paket talebi", href: "/admin/workshops", tone: "text-primary" },
    { icon: Landmark, value: billing.orderRows.length, label: "bekleyen havale", href: "/admin/billing", tone: "text-primary" },
    { icon: Building2, value: rows.length, label: "toplam iş yeri", href: "/admin/workshops", tone: "text-muted-foreground" },
    { icon: PhoneIncoming, value: newDemoCount, label: "yeni demo talebi", href: "/admin/leads", tone: "text-primary" },
    { icon: LifeBuoy, value: newSupportCount, label: "yeni destek talebi", href: "/admin/leads", tone: "text-primary" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Genel Bakış</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Operasyonel durum ve dikkat gerektirenler.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counters.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:border-primary/40"
          >
            <c.icon className={`size-4 ${c.tone}`} />
            <span className="font-semibold text-foreground">{c.value}</span>
            <span className="text-muted-foreground">{c.label}</span>
          </Link>
        ))}
      </div>

      <HealthBand />

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">Dikkat gerektirenler</h2>
        {pending.length === 0 && billing.orderRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bekleyen iş yok. 👍</p>
        ) : (
          <div className="space-y-2">
            {pending.map((w) => (
              <Link
                key={w.id}
                href={`/admin/workshops/${w.id}`}
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary/40"
              >
                <span>
                  <span className="font-medium text-foreground">{w.name}</span>
                  <span className="ml-2 text-muted-foreground">onay bekliyor</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
            {billing.orderRows.length > 0 && (
              <Link
                href="/admin/billing"
                className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary/40"
              >
                <span>
                  <span className="font-medium text-foreground">{billing.orderRows.length} havale</span>
                  <span className="ml-2 text-muted-foreground">teyit bekliyor</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
