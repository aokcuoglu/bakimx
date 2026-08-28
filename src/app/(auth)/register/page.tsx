import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { RegisterClient } from "@/components/auth/register-client"
import { isAuthenticated } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Ücretsiz Dene",
  description: "BakimX oto servis hesabınızı ücretsiz oluşturun — paket veya kart seçmeden 7 iş günü deneyin.",
}

export const dynamic = "force-dynamic"

export default async function RegisterPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard")
  }

  return <RegisterClient />
}
