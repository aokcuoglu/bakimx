"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Loader2, CheckCircle2, ArrowLeft, User, Building2, Mail, Phone, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const formVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.15, ease: "easeOut" as const } },
}

interface FieldErrors {
  name?: string
  businessName?: string
  email?: string
  phone?: string
  subject?: string
  message?: string
  _general?: string
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  function validateField(name: string, value: string): string | undefined {
    switch (name) {
      case "name":
        if (!value.trim() || value.trim().length < 2) return "Ad Soyad en az 2 karakter olmalıdır"
        return undefined
      case "businessName":
        if (!value.trim() || value.trim().length < 2) return "İşletme adı en az 2 karakter olmalıdır"
        return undefined
      case "email":
        if (!value.trim()) return "E-posta adresi zorunludur"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Geçerli bir e-posta adresi girin"
        return undefined
      case "phone":
        if (!value.trim()) return "Telefon numarası zorunludur"
        if (!/^[0-9+\-\s()]{7,15}$/.test(value.trim())) return "Geçerli bir telefon numarası girin"
        return undefined
      case "message":
        if (!value.trim() || value.trim().length < 10) return "Mesaj en az 10 karakter olmalıdır"
        return undefined
      default:
        return undefined
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const fields = {
      name: (formData.get("name") as string) || "",
      businessName: (formData.get("businessName") as string) || "",
      email: (formData.get("email") as string) || "",
      phone: (formData.get("phone") as string) || "",
      subject: (formData.get("subject") as string) || "Şifre Desteği",
      message: (formData.get("message") as string) || "",
    }

    const newErrors: FieldErrors = {}
    for (const [key, value] of Object.entries(fields)) {
      if (key === "subject") continue
      const err = validateField(key, value)
      if (err) newErrors[key as keyof FieldErrors] = err
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/support-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
      } else {
        setErrors({ _general: data.errors?._general || "Bir hata oluştu. Lütfen tekrar deneyin." })
      }
    } catch {
      setErrors({ _general: "Bir hata oluştu. Lütfen tekrar deneyin." })
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <motion.div
        variants={formVariants}
        initial="hidden"
        animate="visible"
        className="w-full text-center"
      >
        <div className="mb-8">
          <div className="mx-auto size-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle2 className="size-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] tracking-tight">Talep Alındı</h1>
          <p className="mt-3 text-[#475569] text-sm leading-relaxed max-w-sm mx-auto">
            Talebiniz alındı. Ekibimiz sizinle en kısa sürede iletişime geçecektir.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-[#2563EB] hover:text-[#1D4ED8] hover:underline transition-colors"
        >
          <ArrowLeft className="size-4" />
          Giriş sayfasına dön
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={formVariants}
      initial="hidden"
      animate="visible"
      className="w-full"
    >
      <div className="mb-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0B1F3A] transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Giriş sayfasına dön
        </Link>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#0B1F3A] tracking-tight">
          Şifre Desteği Talebi
        </h1>
        <p className="mt-2 text-[#475569] text-sm lg:text-base">
          Şifre sıfırlama işlemi için bizimle iletişime geçin. Ekibimiz size dönüş sağlayacaktır.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {errors._general && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {errors._general}
          </div>
        )}

        <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#475569] leading-relaxed">
          Giriş yaptığınız e-posta adresini ve işletme adınızı belirtmeniz süreci hızlandırır.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-[#475569]">
              Ad Soyad
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8] pointer-events-none" />
              <Input
                id="name"
                name="name"
                placeholder="Adınız Soyadınız"
                required
                className="h-11 pl-10 rounded-xl border-[#E2E8F0] bg-white text-base focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/20"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
            </div>
            {errors.name && (
              <p id="name-error" className="text-xs text-red-600">
                {errors.name}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-sm font-medium text-[#475569]">
              İşletme Adı
            </Label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8] pointer-events-none" />
              <Input
                id="businessName"
                name="businessName"
                placeholder="İşletme Adı"
                required
                className="h-11 pl-10 rounded-xl border-[#E2E8F0] bg-white text-base focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/20"
                aria-invalid={!!errors.businessName}
                aria-describedby={errors.businessName ? "businessName-error" : undefined}
              />
            </div>
            {errors.businessName && (
              <p id="businessName-error" className="text-xs text-red-600">
                {errors.businessName}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium text-[#475569]">
              E-posta
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8] pointer-events-none" />
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="ornek@email.com"
                required
                className="h-11 pl-10 rounded-xl border-[#E2E8F0] bg-white text-base focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/20"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
            </div>
            {errors.email && (
              <p id="email-error" className="text-xs text-red-600">
                {errors.email}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium text-[#475569]">
              Telefon
            </Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#94A3B8] pointer-events-none" />
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="0 (5XX) XXX XX XX"
                required
                className="h-11 pl-10 rounded-xl border-[#E2E8F0] bg-white text-base focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/20"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? "phone-error" : undefined}
              />
            </div>
            {errors.phone && (
              <p id="phone-error" className="text-xs text-red-600">
                {errors.phone}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject" className="text-sm font-medium text-[#475569]">
            Konu
          </Label>
          <Input
            id="subject"
            name="subject"
            value="Şifre Desteği"
            readOnly
            className="h-11 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] text-base cursor-not-allowed"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message" className="text-sm font-medium text-[#475569]">
            Mesaj
          </Label>
          <div className="relative">
            <MessageSquare className="absolute left-3.5 top-3.5 size-4 text-[#94A3B8] pointer-events-none" />
            <Textarea
              id="message"
              name="message"
              placeholder="Mesajınızı buraya yazın..."
              required
              rows={4}
              className="pl-10 rounded-xl border-[#E2E8F0] bg-white text-base focus-visible:border-[#2563EB] focus-visible:ring-2 focus-visible:ring-[#2563EB]/20 min-h-[100px]"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "message-error" : undefined}
            />
          </div>
          {errors.message && (
            <p id="message-error" className="text-xs text-red-600">
              {errors.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-base font-medium transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Gönderiliyor...
            </span>
          ) : (
            "Talep Gönder"
          )}
        </Button>
      </form>
    </motion.div>
  )
}
