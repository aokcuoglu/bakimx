import Link from "next/link"
import { Plus, UserPlus, Car, MessageCircle, Camera, Wallet, FileText, CalendarClock } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickAction {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  bgColor: string
  enabled: boolean
}

const actions: QuickAction[] = [
  {
    label: "Yeni İş Emri",
    icon: Plus,
    href: "/orders/new",
    color: "text-primary",
    bgColor: "bg-primary/10",
    enabled: true,
  },
  {
    label: "Yeni Müşteri",
    icon: UserPlus,
    href: "/customers/new",
    color: "text-success",
    bgColor: "bg-success/10",
    enabled: true,
  },
  {
    label: "Yeni Araç",
    icon: Car,
    href: "/vehicles/new",
    color: "text-primary",
    bgColor: "bg-primary/10",
    enabled: true,
  },
  {
    label: "Onay Bekleyenler",
    icon: MessageCircle,
    href: "/orders?status=waiting_approval",
    color: "text-warning",
    bgColor: "bg-warning/10",
    enabled: true,
  },
  {
    label: "Yeni Teklif",
    icon: FileText,
    href: "/quotes/new",
    color: "text-success",
    bgColor: "bg-success/10",
    enabled: true,
  },
  {
    label: "Yeni Randevu",
    icon: CalendarClock,
    href: "/appointments/new",
    color: "text-primary",
    bgColor: "bg-primary/10",
    enabled: true,
  },
  {
    label: "Eksik Fotoğraflar",
    icon: Camera,
    href: "/orders",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    enabled: true,
  },
  {
    label: "Müşteri Bakiye Özeti",
    icon: Wallet,
    href: "/customers/balances",
    color: "text-primary",
    bgColor: "bg-primary/10",
    enabled: true,
  },
]

export function QuickActions() {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Hızlı İşlemler</h3>
      </div>
      <div className="grid grid-cols-2 gap-0">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link
              key={a.label}
              href={a.enabled ? a.href : "#"}
              className={cn(
                "flex items-center gap-2.5 px-4 py-3.5 transition-colors",
                a.enabled
                  ? "hover:bg-muted border-b border-r border-border"
                  : "opacity-50 cursor-not-allowed border-b border-r border-border"
              )}
              {...(!a.enabled ? { onClick: (e) => e.preventDefault() } : {})}
            >
              <div className={`size-9 rounded-lg ${a.bgColor} flex items-center justify-center shrink-0`}>
                <Icon className={`size-4 ${a.color}`} />
              </div>
              <span className="text-xs font-medium text-foreground">{a.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
