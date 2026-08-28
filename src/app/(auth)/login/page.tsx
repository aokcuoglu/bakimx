import type { Metadata } from "next"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { LoginForm } from "@/components/auth/login-form"

export const metadata: Metadata = {
  title: "Giriş Yap",
  description: "BakimX hesabınıza giriş yapın.",
}

export default async function LoginPage({
  searchParams,
}: {
  // ?expired=<lockReason>: planı bittiği için oturumu kapatılan kullanıcı.
  // ?reason=<session_invalid|session_loop>: oturumu çözülemediği için kapatılan
  // kullanıcı (bkz. lib/session-recovery.ts). İkisi de aynı bilgi notunu besler.
  searchParams: Promise<{ expired?: string; reason?: string; advisorInvited?: string }>
}) {
  const { expired, reason, advisorInvited } = await searchParams
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          <LoginForm
            expiredReason={expired ?? reason}
            successNotice={advisorInvited === "1" ? "Satış hesabınız oluşturuldu. E-posta adresiniz ve şifrenizle giriş yapabilirsiniz." : undefined}
          />
        </div>
      </div>
    </div>
  )
}
