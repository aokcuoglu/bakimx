import type { Metadata } from "next"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { ForgotPasswordSidebar } from "@/components/auth/forgot-password-sidebar"
import { RegisterFooter } from "@/components/auth/register-footer"
import styles from "@/components/auth/register-design.module.css"
import { Header } from "@/components/sections/Header"

export const metadata: Metadata = {
  title: "Şifremi Unuttum",
  description: "BakimX hesabınızın şifresini e-posta ile sıfırlayın.",
}

export default function ForgotPasswordPage() {
  return (
    <div className={styles.viewport}>
      <Header />
      <div className={styles.layout}>
        <ForgotPasswordSidebar />
        <main
          aria-label="Şifre sıfırlama formu"
          className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:py-12 lg:px-14 xl:px-20"
        >
          <div className="w-full max-w-md">
            <ForgotPasswordForm />
          </div>
        </main>
      </div>
      <RegisterFooter className="px-5 py-4 sm:px-8" />
    </div>
  )
}
