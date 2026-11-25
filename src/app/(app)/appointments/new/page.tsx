import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { AppointmentCreateForm } from "@/components/appointments/appointment-create-form"

export const metadata = { title: "Yeni Randevu" }

export default async function NewAppointmentPage() {
  const paywall = await getFeaturePaywall("appointments")
  if (paywall) return paywall
  const { workshop } = await getAppData()

  // Müşteri ve araç listeleri artık istemciye toptan indirilmiyor: müşteri
  // sunucu tarafı arama uç noktasından, araçlar da seçilen müşteriye göre
  // çekiliyor (#178).
  return (
    <AppShell constrained workshopName={workshop?.name}>
      <AppointmentCreateForm />
    </AppShell>
  )
}
