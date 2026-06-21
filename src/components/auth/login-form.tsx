"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Mail, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.15, ease: "easeOut" as const } },
}

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email?.trim()) {
      setError("E-posta adresi zorunludur")
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
      })
      const data = await res.json()
      if (data.success) {
        router.push("/app")
      } else {
        setError(data.error || "Giriş başarısız")
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
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
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">
            E-posta
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ornek@email.com"
              defaultValue="demo@bakimx.com"
              required
              className="h-10 pl-9"
            />
          </div>
        </div>

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
              defaultValue="demo123456"
              required
              className="h-10 pl-9 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={loading}
          className="w-full h-10"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
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
      </form>
    </motion.div>
  )
}