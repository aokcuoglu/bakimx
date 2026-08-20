"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, KeyRound, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changeOwnPasswordAction } from "@/app/(app)/account/actions"
import { logoutAction } from "@/app/(auth)/login/actions"

/**
 * Geçici şifre kapısı — tam ekran (BAK-37).
 *
 * `(app)/layout.tsx` bunu plan kilidiyle AYNI yerde render eder: kapı tek bir
 * noktada dursun, tek tek sayfalara serpiştirilmesin. Kullanıcı bu ekranı
 * geçmeden uygulamanın hiçbir yerini göremez; sunucu tarafındaki ikizi
 * `assertPasswordChanged` (bkz. `requireWritableWorkshop`) doğrudan action
 * çağrılarını da kapatır.
 *
 * Mevcut şifre alanı BİLEREK var: bu ekran serviste dolaşan ortak bir tablette
 * açık kalabilir; olmasaydı yanından geçen biri hesabı devralabilirdi.
 */
export function ForcePasswordChange({ displayName }: { displayName: string }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const res = await changeOwnPasswordAction(new FormData(e.currentTarget))
      if (res.ok) {
        // Kapı sunucuda oturum kullanıcısından okunuyor — yeniden çizim şart.
        router.refresh()
      } else {
        setError(res.error)
        setLoading(false)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-7 text-primary" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Şifrenizi belirleyin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Hoş geldiniz{displayName ? `, ${displayName}` : ""}. Hesabınız geçici bir şifreyle
            açıldı. Devam etmek için kendi şifrenizi belirleyin — bunu yalnız siz bileceksiniz.
          </p>
        </div>

        <div className="rounded-2xl border bg-background p-5 shadow-sm sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive-strong text-sm"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword" className="text-sm font-medium text-muted-foreground">
                Geçici şifre
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Size verilen şifre"
                  className="pl-9 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">
                Yeni şifre
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="En az 8 karakter"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-muted-foreground">
                Yeni şifre (tekrar)
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Şifreyi tekrar girin"
                  className="pl-9"
                />
              </div>
            </div>

            <Button type="submit" size="xl" disabled={loading} className="w-full">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Kaydediliyor...
                </span>
              ) : (
                "Şifremi Kaydet ve Devam Et"
              )}
            </Button>
          </form>
        </div>

        {/* Ortak tablette yanlış hesapla açılmış olabilir — çıkış yolu görünür kalsın. */}
        <form action={logoutAction} className="mt-4 text-center">
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
            Bu ben değilim — çıkış yap
          </Button>
        </form>
      </div>
    </div>
  )
}
