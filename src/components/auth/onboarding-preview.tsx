import { BarChart3, CalendarDays, Car, ClipboardList, LayoutDashboard, Package, Settings2, Users, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { label: "Ana panel", icon: LayoutDashboard },
  { label: "İş emirleri", icon: ClipboardList },
  { label: "Müşteriler", icon: Users },
  { label: "Araçlar", icon: Car },
  { label: "Randevular", icon: CalendarDays },
  { label: "Stok ve parçalar", icon: Package },
  { label: "Raporlar", icon: BarChart3 },
  { label: "Ayarlar", icon: Settings2 },
] as const

const ACTIVE_NAV = [0, 1, 2, 5] as const
const PREVIEW_TITLES = ["Servisinizin merkezi", "İşlerinize göre şekillenir", "Ekibinizle birlikte", "İhtiyacınız olan araçlar"] as const

/** Product-shaped preview, intentionally using placeholders instead of real tenant data. */
export function OnboardingPreview({ step }: { step: number }) {
  return (
    <div aria-hidden="true" className="w-[540px] max-w-none translate-x-10">
      <div className="mb-5 max-w-sm">
        <p className="text-xs font-medium text-muted-foreground">BakımX · Örnek görünüm</p>
        <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">{PREVIEW_TITLES[step]}</p>
      </div>
      <div className="flex h-[470px] overflow-hidden rounded-xl border border-border bg-background shadow-lg">
        <div className="w-[175px] shrink-0 border-r border-border bg-card px-3 py-4">
          <div className="mb-6 flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1.5">
            <span className="flex size-6 items-center justify-center rounded bg-foreground text-[11px] font-semibold text-background">B</span>
            <span className="text-xs font-semibold text-foreground">Servisim</span>
          </div>
          <div className="space-y-1">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon
              return (
                <div key={item.label} className={cn("flex items-center gap-2 rounded-md px-2 py-2 text-xs text-muted-foreground", ACTIVE_NAV[step] === index && "bg-muted text-foreground")}>
                  <Icon className="size-3.5 shrink-0" />
                  <span>{item.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex h-14 items-center justify-between border-b border-border px-5">
            <span className="text-sm font-semibold text-foreground">{NAV_ITEMS[ACTIVE_NAV[step]].label}</span>
            <span className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-xs font-medium">S</span>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-2">
              {["Açık işler", "Bugün", "Tamamlanan"].map((label, index) => (
                <div key={label} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <div className={cn("mt-3 h-4 rounded-sm bg-muted", index === step % 3 ? "w-9" : "w-6")} />
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Wrench className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Servis akışı</span>
              </div>
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                  <span className="size-7 rounded-md border border-border bg-muted/50" />
                  <span className="flex-1 space-y-1.5">
                    <span className={cn("block h-1.5 rounded-full bg-muted", row % 2 ? "w-20" : "w-28")} />
                    <span className="block h-1.5 w-14 rounded-full bg-muted/60" />
                  </span>
                  <span className="h-3.5 w-12 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
