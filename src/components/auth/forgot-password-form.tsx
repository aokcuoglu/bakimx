"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import styles from "@/components/auth/register-design.module.css"

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") || "").trim()
    if (!email) {
      setError("E-posta adresi giriniz")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setSuccess(true)
      } else {
        setError(data.error || "İşlem başarısız. Lütfen tekrar deneyin.")
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
          <AlertTitle>E-postanızı kontrol edin</AlertTitle>
          <AlertDescription>
            Eğer bu e-posta bir hesaba bağlıysa, şifre sıfırlama bağlantısı gönderildi.
            Bağlantı 1 saat boyunca geçerlidir.
          </AlertDescription>
        </Alert>

        <Button
          asChild
          variant="outline"
          size="xl"
          className="mt-6 w-full"
        >
          <Link href="/login">
            <ArrowLeft className="size-4" />
            Giriş sayfasına dön
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className={styles.form}>
      <div className="mb-9 border-b border-border pb-7">
        <h1 className="text-2xl font-medium tracking-[-0.035em] text-foreground sm:text-[32px]">
          Şifrenizi sıfırlayın
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Hesabınızın e-posta adresini girin; size bir sıfırlama bağlantısı gönderelim.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            E-posta
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ornek@isyeri.com"
              className="pl-9"
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="foreground"
          size="xl"
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <BrandSpinner size={18} />
              Gönderiliyor...
            </span>
          ) : (
            "Sıfırlama bağlantısı gönder"
          )}
        </Button>

        <div className="border-t pt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-medium text-primary transition-colors hover:underline"
          >
            <ArrowLeft className="size-4" />
            Giriş sayfasına dön
          </Link>
        </div>
      </form>
    </div>
  )
}
