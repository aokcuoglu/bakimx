import { redirect } from "next/navigation"

export const metadata = { title: "Hesabım" }

export default function AccountPage() {
  redirect("/settings/account")
}
