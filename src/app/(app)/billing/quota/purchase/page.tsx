import { redirect } from "next/navigation"

export const metadata = { title: "Faturalandırma" }

/**
 * Bağımsız ek kota satın alımı açık değil (#827): fiyatlı seçenekler ve
 * çalışmayan düğmeler kaldırıldı. Eski bağlantılar kullanım
 * sayfasına yönlenir; ek kota bugün admin tarafından elle verilir.
 */
export default function PurchaseQuotaPage() {
  redirect("/settings/billing#kullanim")
}
