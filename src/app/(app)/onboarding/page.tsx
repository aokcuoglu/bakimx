import { redirect } from "next/navigation"

export const metadata = { title: "İş Yeri Kurulumu" }

export default async function OnboardingPage() {
  redirect("/dashboard")
}
