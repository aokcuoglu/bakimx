import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import { LoginSidebar } from "@/components/auth/login-sidebar"
import { RegisterFooter } from "@/components/auth/register-footer"
import styles from "@/components/auth/register-design.module.css"

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
    <div className={styles.viewport}>
      <div className={styles.layout}>
        <LoginSidebar />
        <main
          aria-label="Hesaba giriş formu"
          className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:py-12 lg:px-14 xl:px-20"
        >
          <div className="w-full max-w-md">
            <LoginForm
              expiredReason={expired ?? reason}
              successNotice={advisorInvited === "1" ? "Satış hesabınız oluşturuldu. E-posta adresiniz ve şifrenizle giriş yapabilirsiniz." : undefined}
            />
          </div>
        </main>
      </div>
      <RegisterFooter className="px-5 py-4 sm:px-8" />
    </div>
  )
}
