import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/login-form"
import styles from "@/components/auth/login.module.css"
import { LandingFooter } from "@/components/marketing/landing/landing-footer"
import { LandingHeader } from "@/components/marketing/landing/landing-header"
import landing from "@/components/marketing/landing/landing.module.css"
import { SignupDialogProvider } from "@/components/marketing/landing/signup-dialog"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Giriş Yap",
  description: "BakimX hesabınıza giriş yapın.",
}

/** Giriş — ana sayfanın e-santral düzeni (#796): üst bant, ortalanmış kart, alt bant. */
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
    <SignupDialogProvider>
      <div className={cn(landing.page, styles.shell)}>
        <LandingHeader anchorBase="/" />
        <main aria-label="Hesaba giriş formu" className={styles.main}>
          <div className={styles.card}>
            <LoginForm
              expiredReason={expired ?? reason}
              successNotice={advisorInvited === "1" ? "Satış hesabınız oluşturuldu. E-posta adresiniz ve şifrenizle giriş yapabilirsiniz." : undefined}
            />
          </div>
        </main>
        <LandingFooter anchorBase="/" />
      </div>
    </SignupDialogProvider>
  )
}
