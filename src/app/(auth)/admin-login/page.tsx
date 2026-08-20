import type { Metadata } from "next"
import Link from "next/link"
import { ShieldCheck, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/shared/brand-logo"
import { getAdminSsoConfig, logAdminSsoDisabled, type AdminSsoRejection } from "@/lib/admin-sso"

export const metadata: Metadata = {
  title: "BakımX personel girişi",
  robots: { index: false, follow: false },
}

// Yapılandırma runtime env'den okunur; build çıktısına gömülmemeli.
export const dynamic = "force-dynamic"

/**
 * Platform yöneticilerinin `/admin` kapısı (BAK-94).
 *
 * `/login` DEĞİŞMEZ: atölye kullanıcıları e-posta/şifre ile girmeye devam eder,
 * onların Workspace hesabı yok. Burası yalnız BakımX personeli içindir.
 *
 * Reddedilen denemenin GERÇEK sebebi burada gösterilmez — "hangi adres yönetici"
 * sorusunu yanıtlayan bir oracle bırakmamak için tüm ret sebepleri tek bir
 * jenerik metne düşer. Ayrıntı sunucu logunda ve denetim kaydındadır.
 */
const GENERIC_ERROR =
  "Giriş tamamlanamadı. Yetkinizin olduğunu düşünüyorsanız platform yöneticisiyle görüşün."

const ERROR_TITLES: Partial<Record<AdminSsoRejection, string>> = {
  provider_error: "Google girişi tamamlanmadı",
  invalid_state: "Oturum doğrulaması başarısız",
  invalid_request: "Oturum doğrulaması başarısız",
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const config = getAdminSsoConfig()
  if (!config) logAdminSsoDisabled("admin-login page")

  const errorTitle = error ? (ERROR_TITLES[error as AdminSsoRejection] ?? "Erişim yok") : null

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo height={40} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" />
            BakımX personel girişi
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 space-y-4">
          {errorTitle && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertTitle>{errorTitle}</AlertTitle>
              <AlertDescription>{GENERIC_ERROR}</AlertDescription>
            </Alert>
          )}

          {config ? (
            <>
              <p className="text-sm text-muted-foreground">
                Yönetim konsoluna {config.allowedDomain} Google Workspace hesabınızla girin.
              </p>
              <Button size="lg" className="w-full" asChild>
                <a href="/api/auth/admin/google/start">
                  <GoogleMark />
                  Google ile devam et
                </a>
              </Button>
            </>
          ) : (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>Google SSO bu ortamda yapılandırılmamış</AlertTitle>
              <AlertDescription>
                Yönetici girişi kapalı. Yapılandırma tamamlanana kadar bu ekrandan giriş
                yapılamaz.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Atölye hesabınızla mı geldiniz?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Giriş ekranına dönün
          </Link>
        </p>
      </div>
    </div>
  )
}

/**
 * Google'ın "G" markası. Renkler marka varlığının parçası olduğu için tema
 * token'ı kullanılmaz — bu bir durum rengi değil, üçüncü taraf logosudur.
 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
