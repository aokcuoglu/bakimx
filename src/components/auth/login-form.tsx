"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { FloatingField } from "@/components/marketing/kit/floating-field"
import { PillButton } from "@/components/marketing/kit/pill-button"
import { TextLink } from "@/components/marketing/kit/text-link"
import { SignupTrigger } from "@/components/marketing/landing/signup-dialog"
import formStyles from "@/components/marketing/landing/dialog-form.module.css"
import { isEmailIdentifier } from "@/lib/user-identity"
import styles from "@/components/auth/login.module.css"

// On success, send the user to the app (app.bakimx.com in prod). The app origin is
// derived from the current host (no build-time env needed); a validated ?redirect
// param (set by middleware when bouncing an unauth app request to login) wins.
//
// `forcedPath`: sunucunun dayattığı hedef (planı bitmiş workshop → /checkout).
// ?redirect parametresini KASITLI olarak ezer — kilitli oturum istediği app
// sayfasına giremez, denemesi anlamsız bir çıkış turuna yol açar.
function resolveLoginRedirect(forcedPath?: string | null): string {
  const h = window.location.hostname
  const appOrigin = h === "bakimx.com" || h === "www.bakimx.com" ? "https://app.bakimx.com" : ""
  if (forcedPath && forcedPath.startsWith("/") && !forcedPath.startsWith("//")) {
    return appOrigin ? `${appOrigin}${forcedPath}` : forcedPath
  }
  const param = new URLSearchParams(window.location.search).get("redirect")
  if (param) {
    try {
      const u = new URL(param, window.location.origin)
      if (["app.bakimx.com", "bakimx.com", h].includes(u.hostname)) return u.toString()
    } catch {
      // ignore malformed redirect param
    }
  }
  return appOrigin ? `${appOrigin}/dashboard` : "/dashboard"
}

// /login?expired=<lockReason> — planı bittiği için oturumu kapatılan kullanıcıya
// neden çıkarıldığını söyleyen bilgi notu (bkz. api/auth/logout GET).
const EXPIRED_NOTICE: Record<string, string> = {
  trial_expired:
    "Deneme süreniz doldu. Devam etmek için giriş yapın ve size uygun paketi seçin.",
  subscription_expired:
    "Aboneliğiniz sona erdi. Devam etmek için giriş yapın ve paketinizi yenileyin.",
  subscription_inactive:
    "Aboneliğiniz aktif değil. Devam etmek için giriş yapın ve paketinizi yenileyin.",
  // Oturum çerezi geçerliydi ama karşılığı bulunamadı (silinmiş kullanıcı, veri
  // taşıma, yerelde yeniden seed). Kullanıcı sebebi bilmek zorunda değil —
  // yapması gerekeni söylüyoruz.
  session_invalid: "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.",
  session_inactive:
    "Hesabınız devre dışı bırakıldı. Yetkiniz olduğunu düşünüyorsanız iş yeri yöneticinizle görüşün.",
  session_loop:
    "Oturumunuzda bir sorun oluştu ve güvenliğiniz için kapatıldı. Lütfen tekrar giriş yapın.",
}

/** Giriş isteğinin istemci tarafı üst sınırı — sunucunun bağlantı sınırından uzun. */
const LOGIN_TIMEOUT_MS = 20_000

export function LoginForm({
  expiredReason,
  successNotice,
}: {
  expiredReason?: string | null
  successNotice?: string
}) {
  const router = useRouter()
  const expiredNotice = expiredReason ? EXPIRED_NOTICE[expiredReason] : undefined
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  // Tek kimlik alanı (BAK-40 sözleşmesi): `@` varsa e-posta yolu HİÇ değişmeden
  // çalışır; yoksa kullanıcı adı yoludur ve iş yeri kodu alanı progresif açılır.
  const [identifier, setIdentifier] = useState("")
  const usesUsername = identifier.trim().length > 0 && !isEmailIdentifier(identifier)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const formData = new FormData(e.currentTarget)
    const value = (formData.get("identifier") as string) ?? ""
    const password = formData.get("password") as string

    if (!value.trim()) {
      setError("E-posta adresi veya kullanıcı adı zorunludur")
      return
    }
    if (!isEmailIdentifier(value) && !((formData.get("workshopCode") as string) ?? "").trim()) {
      setError("Kullanıcı adıyla giriş için iş yeri kodu gereklidir")
      return
    }
    if (!password) {
      setError("Şifre zorunludur")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: formData,
        // Savunma katmanı: sunucu hiç cevap dönmezse (bkz. pg-connection.ts —
        // ölü bir soket eskiden sorguyu sonsuza kadar asardı) buton sonsuza
        // kadar "Giriş yapılıyor..." göstermesin. Sunucunun kendi bağlantı
        // sınırından (10 sn) sonra devreye giren son çare.
        signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
      })
      const data = await res.json()
      if (data.success) {
        const dest = new URL(resolveLoginRedirect(data.redirect), window.location.origin)
        if (dest.origin === window.location.origin) {
          router.push(dest.pathname + dest.search)
        } else {
          window.location.assign(dest.toString())
        }
      } else {
        setError(data.error || "Giriş başarısız")
      }
    } catch (err) {
      setError(
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Sunucuya ulaşılamıyor. Bağlantınızı kontrol edip tekrar deneyin."
          : "Bir hata oluştu. Lütfen tekrar deneyin."
      )
    } finally {
      setLoading(false)
    }
  }

  // #796: görünüm ana sayfanın e-santral diliyle (kit alanları, hap düğme); davranış aynı.
  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Image className={styles.logo} src="/landing/esantral/bakimx-icon.svg" alt="" width={44} height={40} unoptimized />
      <h1 className={styles.title}>Giriş yap</h1>
      <p className={styles.lead}>BakımX hesabınıza giriş yapın.</p>

      {successNotice && !error && (
        <Alert variant="success" className={styles.notice}>
          <AlertDescription>{successNotice}</AlertDescription>
        </Alert>
      )}
      {expiredNotice && !error && (
        <Alert variant="warning" className={styles.notice}>
          <AlertDescription>{expiredNotice}</AlertDescription>
        </Alert>
      )}

      <div className={formStyles.grid}>
        <FloatingField
          id="identifier"
          name="identifier"
          label="E-posta veya kullanıcı adı"
          // `type="email"` DEĞİL: tarayıcı doğrulaması kullanıcı adını reddederdi.
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          aria-describedby={error ? "login-err" : undefined}
        />

        {/* Kullanıcı adları YALNIZ iş yeri içinde benzersiz — kod olmadan hangi
            hesap olduğu çözülemez. E-posta girenlere hiç gösterilmez. */}
        {usesUsername && (
          <>
            <FloatingField
              id="workshopCode"
              name="workshopCode"
              label="İş yeri kodu"
              type="text"
              autoComplete="organization"
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="workshop-code-hint"
            />
            <p id="workshop-code-hint" className={formStyles.hint}>
              İş yerinizin size verdiği kod. Bilmiyorsanız iş yeri yöneticinize sorun.
            </p>
          </>
        )}

        <FloatingField
          id="password"
          name="password"
          label="Şifre"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          aria-describedby={error ? "login-err" : undefined}
          trailing={
            <Button
              type="button"
              variant="link"
              className={formStyles.passwordToggle}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Gizle" : "Göster"}
            </Button>
          }
        />
      </div>

      {error && (
        <Alert id="login-err" variant="destructive" className={formStyles.error}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PillButton type="submit" size="lg" fullWidth disabled={loading} className={formStyles.submit}>
        {loading ? (
          <span className={styles.loading}>
            <BrandSpinner size={18} />
            Giriş yapılıyor...
          </span>
        ) : (
          "Giriş yap"
        )}
      </PillButton>

      <p className={styles.forgot}>
        <TextLink href="/forgot-password">Şifremi unuttum</TextLink>
      </p>
      <p className={styles.signup}>
        Hesabınız yok mu?{" "}
        <SignupTrigger variant="text" location="login">
          Ücretsiz deneyin
        </SignupTrigger>
      </p>
    </form>
  )
}
