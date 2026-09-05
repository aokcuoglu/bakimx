import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AppointmentCreateForm } from "@/components/appointments/appointment-create-form"

export default async function NewAppointmentPage() {
  const paywall = await getFeaturePaywall("appointments")
  if (paywall) return paywall
  const { workshop } = await getAppData()

  // Müşteri ve araç listeleri artık istemciye toptan indirilmiyor: müşteri
  // sunucu tarafı arama uç noktasından, araçlar da seçilen müşteriye göre
  // çekiliyor (#178).
  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle="Yeni Randevu">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/appointments" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Randevular
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Yeni Randevu</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Müşteriniz için yeni bir servis randevusu oluşturun.
          </p>
        </div>

        <AppointmentCreateForm />
      </div>
    </AppShell>
  )
}
