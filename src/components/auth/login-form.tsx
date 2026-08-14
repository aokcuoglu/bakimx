"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, Lock, Store, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { isEmailIdentifier } from "@/lib/user-identity"

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.15, ease: "easeOut" as const } },
}

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

export function LoginForm({ expiredReason }: { expiredReason?: string | null }) {
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

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          BakimX hesabınıza giriş yapın
        </h1>
        <p className="mt-2 text-muted-foreground text-sm lg:text-base">
          Servis süreçlerinizi yönetmek için giriş yapın.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {expiredNotice && !error && (
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-strong">
            {expiredNotice}
          </div>
        )}
        {error && (
          <div role="alert" aria-live="polite" className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-strong text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-sm font-medium text-muted-foreground">
            E-posta veya kullanıcı adı
          </Label>
          <div className="relative">
            <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              id="identifier"
              name="identifier"
              // `type="email"` DEĞİL: tarayıcı doğrulaması kullanıcı adını reddederdi.
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ornek@email.com veya kullanıcı adınız"
              required
              className="pl-9"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
        </div>

        {/* Kullanıcı adları YALNIZ iş yeri içinde benzersiz — kod olmadan hangi
            hesap olduğu çözülemez. E-posta girenlere hiç gösterilmez. */}
        {usesUsername && (
          <div className="space-y-2">
            <Label htmlFor="workshopCode" className="text-sm font-medium text-muted-foreground">
              İş yeri kodu
            </Label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
              <Input
                id="workshopCode"
                name="workshopCode"
                type="text"
                autoComplete="organization"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ornek-oto-servis"
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              İş yerinizin size verdiği kod. Bilmiyorsanız iş yeri yöneticinize sorun.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
            Şifre
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••"
              required
              className="pl-9 pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>

        <Button
          type="submit"
          size="xl"
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <BrandSpinner size={18} />
              Giriş yapılıyor...
            </span>
          ) : (
            "Giriş Yap"
          )}
        </Button>

        <div className="text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-primary hover:underline transition-colors"
          >
            Şifremi Unuttum
          </Link>
        </div>

        <div className="text-center text-sm text-muted-foreground border-t pt-4">
          Hesabınız yok mu?{" "}
          <Link href="/register" className="text-primary hover:underline transition-colors font-medium">
            Ücretsiz deneyin
          </Link>
        </div>
      </form>
    </motion.div>
  )
}
