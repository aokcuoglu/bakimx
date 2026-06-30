import { redirect } from "next/navigation"

// Eski iki-aşamalı "kabulü iş emrine dönüştür" merkezi kaldırıldı: her kabul
// oluşturulurken iş emri otomatik oluşuyor (createIntakeAction). Bu rota artık
// tek create akışı olan /intakes/new'e yönlenir; bookmark + kaçan linkler için
// emniyet ağı (query parametreleri korunur).
export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()
  if (params.customerId) qs.set("customerId", params.customerId)
  if (params.vehicleId) qs.set("vehicleId", params.vehicleId)
  const q = qs.toString()
  redirect(`/intakes/new${q ? `?${q}` : ""}`)
}
