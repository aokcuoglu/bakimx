import { Clock, Lock } from "lucide-react"
import { logoutAction } from "@/app/(auth)/login/actions"
import { PlanPackages } from "@/components/app/plan-packages"
import { VerifyCardPanel } from "@/components/billing/verify-card-panel"
import type { LockReason } from "@/lib/plan"

const COPY: Record<
  Exclude<LockReason, null>,
  { title: string; description: string; icon: typeof Clock; showPackages: boolean }
> = {
  trial_expired: {
    title: "Deneme süreniz doldu",
    description:
      "7 günlük ücretsiz deneme süreniz sona erdi. Verileriniz güvende — kaldığınız yerden devam etmek için bir paket seçin.",
    icon: Clock,
    showPackages: true,
  },
  subscription_inactive: {
    title: "Aboneliğiniz pasif",
    description:
      "Hesabınızı yeniden etkinleştirmek için bir paket seçin. Verileriniz korunmaktadır.",
    icon: Lock,
    showPackages: true,
  },
  subscription_expired: {
    title: "Aboneliğiniz sona erdi",
    description:
      "Ödenmiş dönem sona erdi. Kaldığınız yerden devam etmek için paketinizi yenileyin — verileriniz güvende.",
    icon: Clock,
    showPackages: true,
  },
  pending: {
    title: "Hesabınız kart doğrulaması bekliyor",
    description:
      "Ücretsiz denemenizi başlatmak için kartınızı doğrulayın. Kartınızdan 1 TL'lik doğrulama provizyonu alınır ve anında iade edilir.",
    icon: Lock,
    showPackages: false,
  },
  rejected: {
    title: "Hesabınız etkin değil",
    description: "Lütfen destek ekibimiz ile iletişime geçin.",
    icon: Lock,
    showPackages: false,
  },
}

export function PlanLocked({
  reason,
  workshopName,
  hasPendingOrder = false,
  verifyToken,
}: {
  reason: Exclude<LockReason, null>
  workshopName?: string
  hasPendingOrder?: boolean
  /** pending durumunda kart doğrulama panelini süren imzalı token (layout üretir). */
  verifyToken?: string
}) {
  const { title, description, icon: Icon, showPackages } = COPY[reason]
  const showVerifyCard = reason === "pending" && !!verifyToken

  return (
    <div className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <Icon className="size-7 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            {description}
          </p>
        </div>

        {showVerifyCard && (
          <div className="mx-auto max-w-md rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
            <VerifyCardPanel vtoken={verifyToken!} />
          </div>
        )}

        {showPackages && (
          <PlanPackages ownedTier={null} workshopName={workshopName} hasPendingOrder={hasPendingOrder} />
        )}

        <form action={logoutAction} className="mt-8 text-center">
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Çıkış yap
          </button>
        </form>
      </div>
    </div>
  )
}
