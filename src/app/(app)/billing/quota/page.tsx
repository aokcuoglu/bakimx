import { redirect } from "next/navigation"

export const metadata = { title: "Faturalandırma" }

export default function QuotaPage() {
  redirect("/account/billing#kullanim")
}
