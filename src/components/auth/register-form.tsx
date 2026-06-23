"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Mail, Lock, Building2, User, Phone, MapPin, CheckCircle2 } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.15, ease: "easeOut" as const } },
}

export function RegisterForm() {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const form = e.currentTarget
    const formData = new FormData(form)

    if (!formData.get("kvkkConsent")) {
      setError("Devam etmek için aydınlatma metnini onaylamanız gerekir")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        setSubmitted(true)
      } else {
        setError(data.error || "Kayıt başarısız")
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <motion.div variants={formVariants} initial="hidden" animate="visible" className="w-full text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Başvurunuz alındı</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
          Hesabınız onaylandığında e-posta ile bilgilendirileceksiniz. Onay sonrası{" "}
          <span className="font-medium text-foreground">15 günlük ücretsiz deneme</span> süreniz başlayacaktır.
        </p>
        <Link href="/login" className={cn(buttonVariants({ size: "xl" }), "mt-7 w-full")}>
          Giriş ekranına dön
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div variants={formVariants} initial="hidden" animate="visible" className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
          BakimX hesabınızı oluşturun
        </h1>
        <p className="mt-2 text-muted-foreground text-sm lg:text-base">
          15 gün ücretsiz deneyin — kredi kartı gerekmez.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="workshopName" className="text-sm font-medium text-muted-foreground">
            İş yeri adı
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input id="workshopName" name="workshopName" required placeholder="Örnek Oto Servis" className="h-10 pl-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-sm font-medium text-muted-foreground">Ad</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
              <Input id="firstName" name="firstName" required placeholder="Adınız" className="h-10 pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-sm font-medium text-muted-foreground">Soyad</Label>
            <Input id="lastName" name="lastName" required placeholder="Soyadınız" className="h-10" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium text-muted-foreground">E-posta</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="ornek@email.com" className="h-10 pl-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium text-muted-foreground">Telefon</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
              <Input id="phone" name="phone" type="tel" required placeholder="0555 123 4567" className="h-10 pl-9" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="city" className="text-sm font-medium text-muted-foreground">Şehir</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
              <Input id="city" name="city" required placeholder="İstanbul" className="h-10 pl-9" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium text-muted-foreground">Adres</Label>
          <Input id="address" name="address" required placeholder="Sanayi Mah. 1. Cad. No:5" className="h-10" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-medium text-muted-foreground">Şifre</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="En az 8 karakter"
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

        <label className="flex items-start gap-2.5 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            name="kvkkConsent"
            className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
          />
          <span>
            <Link href="/privacy" target="_blank" className="text-primary hover:underline">Aydınlatma metni</Link> ve{" "}
            <Link href="/terms" target="_blank" className="text-primary hover:underline">kullanım koşullarını</Link> okudum, onaylıyorum.
          </span>
        </label>

        <Button type="submit" size="xl" disabled={loading} className="w-full">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Hesap oluşturuluyor...
            </span>
          ) : (
            "Ücretsiz Dene"
          )}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="text-primary hover:underline transition-colors font-medium">
            Giriş yapın
          </Link>
        </div>
      </form>
    </motion.div>
  )
}
