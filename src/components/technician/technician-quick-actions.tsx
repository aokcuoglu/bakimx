import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ChevronRight, ClipboardPlus, PackageSearch } from "lucide-react"
import { cn } from "@/lib/utils"

type QuickAction = {
  href: string
  title: string
  icon: LucideIcon
  // Dolgu, metin ve ikon kutusu aynı dizede: theme-tokens.test.ts kontrast
  // eşleşmesini yalnız yan yana duran sınıflarda görür.
  tone: string
}

// Teknisyen ana ekranının giriş noktaları — CTA kartları. Hedeflerin ikisi de
// saha rollerine açık: /orders/new oluşturma merkezi istisnası,
// /technician/parts ise /technician ön eki altında
// (bkz. src/lib/technician-route-access.ts).
export const TECHNICIAN_QUICK_ACTIONS: readonly QuickAction[] = [
  {
    href: "/orders/new",
    title: "Araç Kabul",
    icon: ClipboardPlus,
    tone: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85 [&_[data-slot=icon-box]]:bg-primary-foreground/15",
  },
  {
    href: "/technician/parts",
    title: "Parça Sorgulama",
    icon: PackageSearch,
    tone: "bg-navy text-navy-foreground hover:bg-navy/90 active:bg-navy/85 [&_[data-slot=icon-box]]:bg-navy-foreground/15",
  },
]

export function TechnicianQuickActions() {
  return (
    <nav aria-label="Hızlı işlemler" className="grid grid-cols-2 gap-2 sm:gap-3">
      {TECHNICIAN_QUICK_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group flex min-h-36 flex-col justify-between gap-4 rounded-xl p-5 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:min-h-32 sm:flex-row sm:items-center sm:justify-start sm:gap-5 sm:p-6",
              action.tone
            )}
          >
            <span
              data-slot="icon-box"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl sm:size-14"
            >
              <Icon className="size-6 sm:size-7" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-xl leading-tight font-semibold sm:text-2xl">
              {action.title}
            </span>
            <ChevronRight
              className="hidden size-6 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block"
              aria-hidden="true"
            />
          </Link>
        )
      })}
    </nav>
  )
}
