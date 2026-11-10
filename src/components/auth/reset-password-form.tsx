"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { cn } from "@/lib/utils"
import styles from "@/components/auth/register-design.module.css"

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password") || "")
    const confirmPassword = String(form.get("confirmPassword") || "")

    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalıdır")
      return
    }
    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSuccess(true)
        setTimeout(() => router.push("/login"), 1800)
      } else {
        setError(data.error || "Şifre sıfırlanamadı. Lütfen tekrar deneyin.")
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.form}>
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>Şifreniz güncellendi</AlertTitle>
          <AlertDescription>
            Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz…
          </AlertDescription>
        </Alert>

        <Button
          asChild
          variant="outline"
          size="xl"
          className={cn("mt-6 w-full", styles.submit)}
        >
          <Link href="/login">Giriş sayfasına git</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.form}>
      <div className="mb-9 border-b border-border pb-7">
        <h1 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-[32px]">
          Yeni şifre belirleyin
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Hesabınız için yeni bir şifre girin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            Yeni şifre
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="En az 8 karakter"
              className="h-7 rounded-[8px] bg-card pl-9 pr-9 shadow-xs"
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Yeni şifre (tekrar)
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Şifreyi tekrar girin"
              className="h-7 rounded-[8px] bg-card pl-9 shadow-xs"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="foreground"
          size="xl"
          disabled={loading}
          className={cn("w-full", styles.submit)}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <BrandSpinner size={18} />
              Güncelleniyor...
            </span>
          ) : (
            "Şifreyi Güncelle"
          )}
        </Button>

        <div className="border-t pt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-primary transition-colors hover:underline"
          >
            Giriş sayfasına dön
          </Link>
        </div>
      </form>
    </div>
  )
}
