import type { ComponentType, ReactNode } from "react"
import {
  Car,
  Check,
  ClipboardList,
  Mail,
  Settings2,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean }>

/** Attio tarzı mini ürün çerçevesi — trafik ışığı rengi yok, nötr chrome. */
function MiniAppFrame({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-xs",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="flex gap-1">
          <span className="size-1.5 rounded-full bg-foreground/25" />
          <span className="size-1.5 rounded-full bg-foreground/25" />
          <span className="size-1.5 rounded-full bg-foreground/25" />
        </span>
        <span className="ml-1 truncate font-mono text-[10px] tracking-tight text-muted-foreground">
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

function StatusPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        active
          ? "border-foreground/20 bg-foreground text-card"
          : "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      {label}
    </span>
  )
}

function SkeletonLine({ className }: { className?: string }) {
  return <span className={cn("block h-1.5 rounded-full bg-muted", className)} />
}

/** Giriş: iş emri panosu önizlemesi */
export function LoginSidebarVisual() {
  const rows = [
    { plate: "34 ABC 123", meta: "Periyodik bakım", status: "Devam", active: true, icon: Wrench },
    { plate: "06 XYZ 789", meta: "Kaporta / boya", status: "Bekliyor", active: false, icon: Car },
    { plate: "35 DEF 456", meta: "Yağ & filtre", status: "Hazır", active: false, icon: ClipboardList },
  ] as const

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl bg-muted/35"
      />
      <MiniAppFrame title="app.bakimx.com/orders">
        <div className="space-y-1.5 p-2.5">
          <div className="flex items-center justify-between gap-2 px-0.5">
            <p className="text-[11px] font-medium text-foreground">Bugünkü iş emirleri</p>
            <StatusPill label="3 açık" active />
          </div>
          <ul className="space-y-1">
            {rows.map((row) => {
              const Icon = row.icon
              return (
                <li
                  key={row.plate}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-border px-2 py-1.5",
                    row.active ? "bg-muted/70" : "bg-card",
                  )}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                    <Icon className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-foreground">
                      {row.plate}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {row.meta}
                    </span>
                  </span>
                  <StatusPill label={row.status} active={row.active} />
                </li>
              )
            })}
          </ul>
        </div>
      </MiniAppFrame>
    </div>
  )
}

/** Kayıt: kurulum yolculuğu önizlemesi */
export function RegisterSidebarVisual() {
  const steps = [
    { label: "Hesap", icon: Mail, done: true },
    { label: "Doğrulama", icon: Check, done: false, active: true },
    { label: "Kurulum", icon: Settings2, done: false },
  ] as const

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-2 -z-10 rounded-2xl bg-muted/35"
      />
      <MiniAppFrame title="Kurulum önizlemesi">
        <div className="space-y-2.5 p-2.5">
          <div className="flex items-center gap-1.5">
            {steps.map((step, index) => {
              const Icon = step.icon
              const active = "active" in step && step.active
              return (
                <div key={step.label} className="flex min-w-0 flex-1 items-center gap-1.5">
                  <div
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground",
                      step.done && "border-foreground bg-foreground text-card",
                      active && "border-foreground bg-muted text-foreground",
                      !step.done && !active && "border-border bg-card",
                    )}
                  >
                    <Icon className="size-3" />
                  </div>
                  {index < steps.length - 1 && (
                    <span
                      className={cn(
                        "h-px min-w-0 flex-1",
                        step.done ? "bg-foreground/40" : "bg-border",
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Servis kartı
            </p>
            <div className="mt-1.5 flex items-start gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                <Car className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                <SkeletonLine className="w-24" />
                <SkeletonLine className="w-16" />
                <div className="flex gap-1 pt-0.5">
                  <StatusPill label="Oto servis" />
                  <StatusPill label="2–5 kişi" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {["İş emri", "Stok", "Cari"].map((label) => (
              <div
                key={label}
                className="rounded-md border border-border bg-card px-1.5 py-1.5 text-center"
              >
                <SkeletonLine className="mx-auto w-6" />
                <p className="mt-1 text-[9px] font-medium text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </MiniAppFrame>
    </div>
  )
}

export function AuthFeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: IconType
  title: string
  description: string
}) {
  return (
    <li className="flex gap-2.5 rounded-lg border border-border bg-card/80 p-2.5 shadow-xs">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5 text-foreground">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{description}</span>
      </span>
    </li>
  )
}

export function AuthStepCard({
  index,
  title,
  description,
}: {
  index: number
  title: string
  description: string
}) {
  return (
    <li className="relative flex gap-2.5 rounded-lg border border-border bg-card/80 p-2.5 shadow-xs">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[11px] font-semibold text-foreground">
        {index}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium leading-5 text-foreground">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{description}</span>
      </span>
    </li>
  )
}
