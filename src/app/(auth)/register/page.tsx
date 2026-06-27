import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { RegisterForm } from "@/components/auth/register-form"
import { isAuthenticated } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Ücretsiz Dene",
  description: "BakimX iş yeri hesabınızı oluşturun — 15 gün ücretsiz deneme.",
}

export default async function RegisterPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
