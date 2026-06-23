"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Eye, EyeOff, Loader2, Lock, User, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { acceptInviteAction } from "@/app/invite/[token]/actions"

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.1, ease: "easeOut" as const } },
}

export function SetPasswordForm({
  token,
  email,
  workshopName,
  roleLabel,
}: {
  token: string
  email: string
  workshopName: string
  roleLabel: string
}) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirm = formData.get("passwordConfirm") as string
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor")
      return
    }

    setLoading(true)
    try {
      const res = await acceptInviteAction(token, formData)
      if (res.ok) {
        router.push("/login?invited=1")
      } else {
        setError(res.error)
      }
    } catch {
      setError("Bir hata oluştu. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div variants={formVariants} initial="hidden" animate="visible" className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Ekibe katılın</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{workshopName}</span> sizi{" "}
          <span className="font-medium text-foreground">{roleLabel}</span> olarak davet etti. Hesabınızı
          oluşturmak için bilgilerinizi girin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">E-posta</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input value={email} disabled readOnly className="h-10 pl-9 bg-muted/50" />
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

        <div className="space-y-2">
          <Label htmlFor="passwordConfirm" className="text-sm font-medium text-muted-foreground">Şifre (tekrar)</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70 pointer-events-none" />
            <Input
              id="passwordConfirm"
              name="passwordConfirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Şifreyi tekrar girin"
              className="h-10 pl-9"
            />
          </div>
        </div>

        <Button type="submit" size="xl" disabled={loading} className="w-full">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Hesap oluşturuluyor...
            </span>
          ) : (
            "Hesabı Oluştur ve Katıl"
          )}
        </Button>
      </form>
    </motion.div>
  )
}
