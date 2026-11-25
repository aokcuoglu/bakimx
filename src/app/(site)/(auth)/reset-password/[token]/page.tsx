import type { Metadata } from "next"
import Link from "next/link"
import { TriangleAlert } from "lucide-react"
import { prisma } from "@/lib/db"
import { ForgotPasswordSidebar } from "@/components/auth/forgot-password-sidebar"
import { RegisterFooter } from "@/components/auth/register-footer"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import styles from "@/components/auth/register-design.module.css"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { hashResetToken, isResetExpired } from "@/lib/password-reset"

export const metadata: Metadata = {
  title: "Yeni Şifre Belirle",
  description: "BakimX hesabınız için yeni şifre belirleyin.",
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
  })
  const valid = !!record && !record.usedAt && !isResetExpired(record.expiresAt)

  return (
    <div className={styles.viewport}>
      <div className={styles.layout}>
        <ForgotPasswordSidebar />
        <main
          aria-label="Yeni şifre belirleme formu"
          className="no-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-8 sm:px-10 sm:py-12 lg:px-14 xl:px-20"
        >
          <div className="w-full max-w-md">
            {valid ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className={styles.form}>
                <Alert variant="warning">
                  <TriangleAlert />
                  <AlertTitle>Bağlantı geçersiz</AlertTitle>
                  <AlertDescription>
                    Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir
                    bağlantı talep edin.
                  </AlertDescription>
                </Alert>

                <Button
                  asChild
                  variant="foreground"
                  size="xl"
                  className="mt-6 w-full sm:w-auto"
                >
                  <Link href="/forgot-password">Yeni bağlantı talep et</Link>
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
      <RegisterFooter className="px-5 py-4 sm:px-8" />
    </div>
  )
}
