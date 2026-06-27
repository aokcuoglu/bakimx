import type { Metadata } from "next"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Giriş Yap",
  description: "BakimX hesabınıza giriş yapın.",
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
