import { CheckCircle2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FeatureUpgradeActions } from "@/components/billing/feature-upgrade-actions"
import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import type { GatedFeature, PlanTier } from "@/lib/plan"

export function FeaturePaywall({
  feature,
  currentTier,
  itemCount,
}: {
  feature: GatedFeature
  currentTier: PlanTier
  itemCount: number
}) {
  const definition = FEATURE_CATALOG[feature]
  const targetLabel = definition.targetTier === "premium" ? "Premium" : "Profesyonel"

  return (
    <AppShell pageTitle={definition.name} showGlobalSearch={false} wide>
      <div className="mx-auto flex min-h-[65vh] max-w-4xl items-center justify-center py-6 sm:py-10">
        <Card className="relative w-full overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl" />
          <CardHeader className="relative items-center px-5 pt-8 text-center sm:px-10 sm:pt-12">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <LockKeyhole className="size-7" />
            </div>
            <Badge variant="secondary" className="mb-2">
              <Sparkles className="size-3" /> {targetLabel} özelliği
            </Badge>
            <CardTitle className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
              {definition.title}
            </CardTitle>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {definition.description}
            </p>
          </CardHeader>
          <CardContent className="relative px-5 pb-8 sm:px-10 sm:pb-12">
            {itemCount > 0 && (
              <div className="mx-auto mb-6 flex max-w-xl items-start gap-3 rounded-xl border border-success/20 bg-success/10 p-4 text-success-strong">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" />
                <p className="text-sm">
                  <span className="font-semibold">{itemCount} {definition.countLabel}.</span>{" "}
                  Verileriniz silinmedi; yükselttiğinizde yeniden erişebilirsiniz.
                </p>
              </div>
            )}
            <ul className="mx-auto mb-7 grid max-w-2xl gap-3 sm:grid-cols-3">
              {definition.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 rounded-lg border bg-card p-3 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-strong" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <FeatureUpgradeActions
              feature={feature}
              currentTier={currentTier}
              targetTier={definition.targetTier}
              placement="page"
            />
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Paket değişikliğinden sonra bu özellik otomatik olarak açılır.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
