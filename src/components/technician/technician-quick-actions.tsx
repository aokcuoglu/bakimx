import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ClipboardPlus, PackageSearch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TECHNICIAN_INTAKE_HREF } from "@/lib/sidebarless-route"

type QuickAction = {
  href: string
  title: string
  icon: LucideIcon
  variant: "default" | "outline"
}

// Teknisyen ana ekranının giriş noktaları — iki büyük tuş. Hedeflerin ikisi de
// saha rollerine açık: /orders/new oluşturma merkezi istisnası,
// /technician/parts ise /technician ön eki altında
// (bkz. src/lib/technician-route-access.ts).
export const TECHNICIAN_QUICK_ACTIONS: readonly QuickAction[] = [
  {
    // Doğrudan plaka aramasıyla açılır (bkz. parseEntryMethod).
    href: TECHNICIAN_INTAKE_HREF,
    title: "Araç Kabul",
    icon: ClipboardPlus,
    variant: "default",
  },
  {
    href: "/technician/parts",
    title: "Parça Ara",
    icon: PackageSearch,
    variant: "outline",
  },
]

export function TechnicianQuickActions() {
  // lg+ masaüstünde aynı iki işlem sayfa başlığındadır (page-headers.ts); büyük
  // kiosk tuşları yalnız telefonda/tablette çizilir.
  return (
    <nav aria-label="Hızlı işlemler" className="grid grid-cols-2 gap-3 lg:hidden">
      {TECHNICIAN_QUICK_ACTIONS.map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.href}
            asChild
            size="xl"
            variant={action.variant}
            className="w-full"
          >
            <Link href={action.href}>
              <Icon aria-hidden="true" />
              {action.title}
            </Link>
          </Button>
        )
      })}
    </nav>
  )
}
