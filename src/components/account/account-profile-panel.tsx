"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { AccountPasswordForm } from "@/components/account/account-password-form"
import { AccountProfileForm } from "@/components/account/account-profile-form"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function initials(firstName: string, lastName: string, fallback: string): string {
  const a = firstName.trim()[0]
  const b = lastName.trim()[0]
  if (a && b) return `${a}${b}`.toUpperCase()
  if (a) return a.toUpperCase()
  return fallback.slice(0, 2).toUpperCase() || "?"
}

export function AccountProfilePanel({
  firstName,
  lastName,
  email,
  username,
  roleLabel,
  workshopName,
}: {
  firstName: string
  lastName: string
  email: string | null
  username: string | null
  roleLabel: string
  workshopName: string | null
}) {
  const identity = email || username || ""
  const [copied, setCopied] = useState(false)

  async function copyIdentity() {
    if (!identity) return
    try {
      await navigator.clipboard.writeText(identity)
      setCopied(true)
      toast.success("Kopyalandı")
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Kopyalanamadı")
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 border-b border-border px-4 py-5 sm:flex-row sm:items-center sm:px-6">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-base font-semibold text-foreground"
          aria-hidden
        >
          {initials(firstName, lastName, identity || "BX")}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">
            {[firstName, lastName].filter(Boolean).join(" ") || "Profil"}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {roleLabel}
            {workshopName ? ` · ${workshopName}` : ""}
          </p>
        </div>
      </div>

      <div className="border-b border-border px-4 py-5 sm:px-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Ad</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Uygulama içinde görünen adınız.</p>
        </div>
        <AccountProfileForm firstName={firstName} lastName={lastName} />
      </div>

      {identity ? (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{email ? "E-posta" : "Kullanıcı adı"}</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{identity}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={copyIdentity} className="shrink-0 self-start sm:self-auto">
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Kopyalandı" : "Kopyala"}
          </Button>
        </div>
      ) : null}

      <div className={cn("px-4 py-5 sm:px-6")}>
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Şifre</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Hesabınıza giriş için kullandığınız şifreyi güncelleyin.</p>
        </div>
        <AccountPasswordForm />
      </div>
    </div>
  )
}
