import type { Metadata } from "next"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const metadata: Metadata = {
  title: "Şifremi Sıfırla",
  description: "BakimX hesabınızın şifresini e-posta ile sıfırlayın.",
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[480px]">
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  )
}
