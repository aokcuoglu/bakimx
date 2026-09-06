import Image from "next/image"
import Link from "next/link"
import { Check, CircleCheck, Sparkles } from "lucide-react"
import { BrandLogo } from "@/components/shared/brand-logo"
import {
  REGISTER_STEPS,
  type RegisterWizardSnapshot,
  type TeamSizeId,
} from "@/lib/register-onboarding"
import type { SalePlanTier } from "@/lib/plan"
import { getPlanPackage } from "@/lib/plans-catalog"
import { cn } from "@/lib/utils"

type PreferredPlan = {
  tier: SalePlanTier
  cycle: "monthly" | "yearly"
}

const TEAM_SIZE_LABELS: Record<TeamSizeId, string> = {
  solo: "Sadece ben",
  "2_5": "2–5 kişi",
  "6_10": "6–10 kişi",
  "11_25": "11–25 kişi",
  "26_50": "26–50 kişi",
  "50_plus": "50+ kişi",
}

export function RegisterSidebar({
  snapshot,
  preferredPlan,
}: {
  snapshot: RegisterWizardSnapshot
  preferredPlan?: PreferredPlan
}) {
  const preferredPkg = preferredPlan ? getPlanPackage(preferredPlan.tier) : undefined

  return (
    <aside className="relative isolate hidden min-h-full overflow-hidden bg-navy text-navy-foreground lg:flex lg:w-80 lg:shrink-0 lg:flex-col xl:w-[360px]">
      <Image
        src="/landing/hero-video-poster.jpg"
        alt=""
        fill
        priority
        sizes="360px"
        className="object-cover object-[38%_center]"
        aria-hidden
      />
      <div aria-hidden className="absolute inset-0 bg-navy/90" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-navy/30 via-navy/75 to-navy" />

      <div className="relative flex min-h-full flex-1 flex-col px-7 py-8">
        <Link
          href="/"
          aria-label="BakimX ana sayfa"
          className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-foreground/50"
        >
          <BrandLogo variant="primary-dark" size="lg" priority />
        </Link>

        <div className="mt-8">
          <h2 className="text-2xl font-bold tracking-tight">
            Sisteminizi <span className="text-brand">oluşturun</span>
          </h2>
          <p className="mt-2 max-w-xs text-sm leading-5 text-navy-foreground/70">
            5 adımda oto servisinize göre hazırlanmış ücretsiz hesabınızı kurun.
          </p>
          {preferredPkg && preferredPlan && (
            <div className="mt-4 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
                <Sparkles className="size-3" />
                İlgilendiğiniz paket
              </p>
              <p className="mt-1 text-sm font-semibold text-navy-foreground">
                {preferredPkg.name}
                <span className="ml-1.5 font-normal text-navy-foreground/70">
                  · {preferredPlan.cycle === "yearly" ? preferredPkg.yearlyLabel : preferredPkg.monthlyLabel}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-navy-foreground/60">
                Önce ücretsiz deneyin; deneme bitince bu paketi etkinleştirebilirsiniz.
              </p>
            </div>
          )}
        </div>

        <ol className="mt-7 space-y-4" aria-label="Kayıt adımları">
          {REGISTER_STEPS.map((step, index) => {
            const complete = index < snapshot.currentStep
            const active = index === snapshot.currentStep
            return (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    complete && "border-primary bg-primary text-primary-foreground",
                    active && "border-brand bg-navy-light/70 text-navy-foreground ring-2 ring-brand/20",
                    !complete && !active && "border-navy-foreground/15 bg-navy-foreground/5 text-navy-foreground/60",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {complete ? <Check className="size-4" /> : index + 1}
                </span>
                <span className={cn(!complete && !active && "text-navy-foreground/60")}>
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="block text-xs text-navy-foreground/55">{step.description}</span>
                </span>
              </li>
            )
          })}
        </ol>

        <div className="mt-auto rounded-xl border border-navy-foreground/15 bg-navy-foreground/5 p-4 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-navy-foreground/60">
            Seçimleriniz
          </p>
          <div className="mt-3 space-y-2 text-xs text-navy-foreground/85">
            {snapshot.sector && <SummaryRow label="Oto Servis" />}
            {snapshot.businessFeatureCount > 0 && (
              <SummaryRow label={`${snapshot.businessFeatureCount} iş detayı`} />
            )}
            {snapshot.teamSize && <SummaryRow label={TEAM_SIZE_LABELS[snapshot.teamSize]} />}
            {snapshot.currentStep >= 3 && snapshot.moduleCount > 0 && (
              <SummaryRow label={`${snapshot.moduleCount} modül`} />
            )}
            {!snapshot.sector && (
              <p className="text-navy-foreground/50">Seçimleriniz burada özetlenecek.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}

function SummaryRow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2">
      <CircleCheck className="size-3.5 text-brand" />
      <span>{label}</span>
    </p>
  )
}
