"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const formVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
}

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
      <motion.div
        initial="hidden"
        animate="visible"
        variants={formVariants}
        className="text-center space-y-4"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Şifreniz güncellendi</h1>
        <p className="text-sm text-muted-foreground">
          Yeni şifrenizle giriş yapabilirsiniz. Giriş sayfasına yönlendiriliyorsunuz…
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Giriş sayfasına git
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.form
      initial="hidden"
      animate="visible"
      variants={formVariants}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Yeni şifre belirleyin</h1>
        <p className="text-sm text-muted-foreground">
          Hesabınız için yeni bir şifre girin.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="password">Yeni şifre</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="En az 8 karakter"
            className="pl-9 pr-9"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Yeni şifre (tekrar)</Label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Şifreyi tekrar girin"
            className="pl-9"
            required
          />
        </div>
      </div>

      <Button type="submit" size="xl" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Güncelleniyor…
          </>
        ) : (
          "Şifreyi Güncelle"
        )}
      </Button>

      <div className="text-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          Giriş sayfasına dön
        </Link>
      </div>
    </motion.form>
  )
}
