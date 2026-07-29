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
  // ?expired=<lockReason>: planı bittiği için oturumu kapatılan kullanıcı
  // (bkz. api/auth/logout GET) — formda bilgilendirme notu gösterilir.
  searchParams: Promise<{ expired?: string }>
}) {
  const { expired } = await searchParams
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          <LoginForm expiredReason={expired} />
        </div>
      </div>
    </div>
  )
}
