import { redirect } from "next/navigation"

// Eski "İş Yeri Profili" rotası. İçeriği Ayarlar sekmelerine taşındı:
// iş yeri formu → /settings?tab=profile, teknisyen yönetimi → /settings?tab=team.
// Eski bookmark/linkler kırılmasın diye rota redirect olarak bırakıldı.
export default function WorkshopPage() {
  redirect("/settings?tab=profile")
}
