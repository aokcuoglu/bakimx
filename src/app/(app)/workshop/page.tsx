import { redirect } from "next/navigation"

// Eski "İş Yeri Profili" rotası → çalışma alanı genel ayarları.
export default function WorkshopPage() {
  redirect("/settings/general")
}
