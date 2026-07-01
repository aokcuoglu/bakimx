import Link from "next/link"
import { Sparkles, Lock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Inline upsell shown in place of the AI Servis Danışmanı panel when the
 * workshop's plan does not include the `aiAdvisor` feature (i.e. non-Premium,
 * including trial workshops on the `pro` tier). The advisor APIs enforce the
 * entitlement server-side; this is only the UX surface.
 */
export function AdvisorPremiumLock() {
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          AI Servis Danışmanı
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Lock className="size-2.5" />
            Premium
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Müşteri şikayetinden otomatik kontrol, işçilik ve parça önerileri almak
          için AI Servis Danışmanı Premium pakete özeldir.
        </p>
        <Link
          href="/checkout?tier=premium&cycle=monthly"
          className={cn(buttonVariants({ size: "sm" }), "w-full")}
        >
          <Sparkles className="size-3.5" />
          Premium Pakete Geç
        </Link>
      </CardContent>
    </Card>
  )
}
