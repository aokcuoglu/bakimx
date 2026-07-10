import type { Metadata } from "next"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { AuthVisualPanel } from "@/components/auth/auth-visual-panel"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { hashResetToken, isResetExpired } from "@/lib/password-reset"

export const metadata: Metadata = {
  title: "Şifre Sıfırla",
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-muted">
      <div className="lg:w-[45%] lg:min-h-screen">
        <AuthVisualPanel />
      </div>
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          {valid ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-semibold">Bağlantı geçersiz</h1>
              <p className="text-sm text-muted-foreground">
                Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Lütfen yeni bir
                bağlantı talep edin.
              </p>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Yeni bağlantı talep et
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
