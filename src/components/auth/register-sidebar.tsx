import { Check, CircleCheck, Sparkles } from "lucide-react"
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
  mode = "register",
}: {
  mode?: "register" | "onboarding"
  snapshot: RegisterWizardSnapshot
  preferredPlan?: PreferredPlan
}) {
  const preferredPkg = preferredPlan ? getPlanPackage(preferredPlan.tier) : undefined

  return (
    <aside className="hidden min-h-full border-r border-border bg-card text-foreground lg:flex lg:w-[340px] lg:shrink-0 lg:flex-col xl:w-[400px]">
      <div className="relative flex min-h-full flex-1 flex-col px-9 py-12 xl:px-12">


        <div>
          <h2 className="text-4xl font-medium leading-[1.15] tracking-[-0.045em]">
            {mode === "onboarding" ? "Servisinizi hazırlayın" : "Servisiniz için yeni bir başlangıç."}
          </h2>
          <p className="mt-5 max-w-xs text-sm leading-6 text-muted-foreground">
            {mode === "onboarding" ? "4 adımda servisinize uygun çalışma düzenini belirleyin." : "Firma, iletişim ve giriş bilgilerinizi girin. Servisinizin kurulumunu üyelikten sonra tamamlayın."}
          </p>
          {preferredPkg && preferredPlan && (
            <div className="mt-4 rounded-lg border border-border bg-card px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Sparkles className="size-3" />
                İlgilendiğiniz paket
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {preferredPkg.name}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · {preferredPlan.cycle === "yearly" ? preferredPkg.yearlyLabel : preferredPkg.monthlyLabel}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {preferredPlan.tier === "lite" ? "Lite kapsamı süresiz ücretsizdir. Kart gerekmez; otomatik ücretliye dönüşmez." : "Önce 7 iş günü ücretsiz deneyin; deneme bitince bu paketi kendi onayınızla etkinleştirebilirsiniz."}
              </p>
            </div>
          )}
        </div>

        {mode === "register" && (
          <div className="mt-12 border-t border-border pt-7">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Başlamak çok kolay</p>
            <ol className="mt-5 space-y-6">
              {[
                ["Hesabınızı oluşturun", "Firma ve iletişim bilgilerinizi ekleyin."],
                ["E-postanızı doğrulayın", "Size gönderdiğimiz bağlantıyla devam edin."],
                ["Servisinizi hazırlayın", "Ekibinizi ve çalışma tercihlerinizi belirleyin."],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border text-[11px] text-muted-foreground">{index + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {mode === "onboarding" && <ol className="mt-7 space-y-4" aria-label="Kayıt adımları">
          {REGISTER_STEPS.slice(0, 4).map((step, index) => {
            const complete = index < snapshot.currentStep
            const active = index === snapshot.currentStep
            return (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                    complete && "border-foreground bg-foreground text-card",
                    active && "border-foreground bg-muted text-foreground",
                    !complete && !active && "border-border bg-card text-muted-foreground",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {complete ? <Check className="size-4" /> : index + 1}
                </span>
                <span className={cn(!complete && !active && "text-muted-foreground")}>
                  <span className="block text-sm font-semibold">{step.label}</span>
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                </span>
              </li>
            )
          })}
        </ol>}

        {mode === "onboarding" && <div className="mt-auto rounded-lg border border-border bg-card p-4 backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Seçimleriniz
          </p>
          <div className="mt-3 space-y-2 text-xs text-foreground">
            {snapshot.sector && <SummaryRow label="Oto Servis" />}
            {snapshot.businessFeatureCount > 0 && (
              <SummaryRow label={`${snapshot.businessFeatureCount} iş detayı`} />
            )}
            {snapshot.teamSize && <SummaryRow label={TEAM_SIZE_LABELS[snapshot.teamSize]} />}
            {snapshot.currentStep >= 3 && snapshot.moduleCount > 0 && (
              <SummaryRow label={`${snapshot.moduleCount} modül`} />
            )}
            {!snapshot.sector && (
              <p className="text-muted-foreground">Seçimleriniz burada özetlenecek.</p>
            )}
          </div>
        </div>}
      </div>
    </aside>
  )
}

function SummaryRow({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2">
      <CircleCheck className="size-3.5 text-muted-foreground" />
      <span>{label}</span>
    </p>
  )
}
