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
    href: "/app/orders/new",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    enabled: true,
  },
  {
    label: "Yeni Müşteri",
    icon: UserPlus,
    href: "/app/customers/new",
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    enabled: true,
  },
  {
    label: "Yeni Araç",
    icon: Car,
    href: "/app/vehicles/new",
    color: "text-violet-600",
    bgColor: "bg-violet-100",
    enabled: true,
  },
  {
    label: "Onay Bekleyenler",
    icon: MessageCircle,
    href: "/app/orders?status=waiting_approval",
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    enabled: true,
  },
  {
    label: "Yeni Teklif",
    icon: FileText,
    href: "/app/quotes/new",
    color: "text-green-600",
    bgColor: "bg-green-100",
    enabled: true,
  },
  {
    label: "Yeni Randevu",
    icon: CalendarClock,
    href: "/app/appointments/new",
    color: "text-cyan-600",
    bgColor: "bg-cyan-100",
    enabled: true,
  },
  {
    label: "Eksik Fotoğraflar",
    icon: Camera,
    href: "/app/intakes",
    color: "text-rose-600",
    bgColor: "bg-rose-100",
    enabled: true,
  },
  {
    label: "Müşteri Bakiye Özeti",
    icon: Wallet,
    href: "/app/customers/balances",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
    enabled: true,
  },
]

export function QuickActions() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Hızlı İşlemler</h3>
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
                  ? "hover:bg-slate-50 border-b border-r border-slate-100"
                  : "opacity-50 cursor-not-allowed border-b border-r border-slate-100"
              )}
              {...(!a.enabled ? { onClick: (e) => e.preventDefault() } : {})}
            >
              <div className={`size-9 rounded-lg ${a.bgColor} flex items-center justify-center shrink-0`}>
                <Icon className={`size-4 ${a.color}`} />
              </div>
              <span className="text-xs font-medium text-slate-700">{a.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
