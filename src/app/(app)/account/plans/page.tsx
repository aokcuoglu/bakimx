import { redirect } from "next/navigation"

export const metadata = { title: "Paketler" }

export default function AccountPlansRedirectPage() {
  redirect("/settings/plans")
}
