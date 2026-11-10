"use client"

import { useState } from "react"
import { Check, Copy, Info } from "lucide-react"
import { toast } from "sonner"
import { AccountPasswordForm } from "@/components/account/account-password-form"
import { AccountProfileForm } from "@/components/account/account-profile-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

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
    <div className="space-y-10">
      <Alert className="border-0 bg-muted text-muted-foreground-strong">
        <Info className="size-4 shrink-0" aria-hidden="true" />
        <AlertDescription className="text-muted-foreground-strong">Profil bilgileriniz kişisel hesabınıza aittir.</AlertDescription>
      </Alert>

      <section aria-label="Profil bilgileri" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span
            className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-medium text-foreground"
            aria-hidden
          >
            {initials(firstName, lastName, identity || "BX")}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Profil resmi</p>
            <p className="truncate text-sm text-muted-foreground">
              {[firstName, lastName].filter(Boolean).join(" ") || "Profil"}
              {" · "}
              {roleLabel}
              {workshopName ? ` · ${workshopName}` : ""}
            </p>
          </div>
        </div>

        <AccountProfileForm firstName={firstName} lastName={lastName} />

        {identity ? (
          <div>
            <h2 className="mb-1 text-xs font-medium text-muted-foreground">{email ? "Birincil e-posta adresi" : "Kullanıcı adı"}</h2>
            <div className="flex min-h-8 items-center justify-between gap-2 rounded-lg border border-input px-2.5 py-1">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{identity}</p>
              <Button type="button" variant="outline" size="xs" onClick={copyIdentity} className="shrink-0">
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="password-heading" className="space-y-5">
        <div>
          <h2 id="password-heading" className="text-base font-semibold text-foreground">Şifre</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Hesabınıza giriş için kullandığınız şifreyi güncelleyin.</p>
        </div>
        <AccountPasswordForm />
      </section>
    </div>
  )
}
