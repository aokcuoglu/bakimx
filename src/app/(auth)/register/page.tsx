import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { RegisterForm } from "@/components/auth/register-form"
import { isAuthenticated } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Ücretsiz Dene",
  description: "BakimX iş yeri hesabınızı oluşturun — kart doğrulamasının ardından 7 gün ücretsiz deneme.",
}

export default async function RegisterPage() {
  if (await isAuthenticated()) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:h-screen bg-muted">
      <div className="lg:w-[38%] shrink-0">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center lg:items-start justify-center p-6 lg:p-10 lg:overflow-y-auto">
        <div className="w-full max-w-[520px]">
          <RegisterForm />
        </div>
      </div>
    </div>
  )
}
