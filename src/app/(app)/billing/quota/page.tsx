import { redirect } from "next/navigation"

export const metadata = { title: "Paketler & Kullanım" }

export default function QuotaPage() {
  redirect("/billing#kullanim")
}
