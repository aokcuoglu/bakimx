"use client"

import { useState, useTransition } from "react"
import { Check, KeyRound, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { sendUserPasswordReset } from "@/app/admin/actions"

/**
 * Destek müdahalesi (BAK-97): iş yeri detayında kullanıcı başına
 * "Şifre sıfırlama bağlantısı gönder".
 *
 * Bilerek hiçbir bağlantı GÖSTERMEZ — token yalnız kullanıcının kendi
 * e-postasına gider. Buton yalnız yetkili rollerde render edilir, ama sınır
 * sunucudadır: aksiyon her çağrıda yeteneği ve kullanıcının iş yerini
 * yeniden doğrular.
 */
export function SendPasswordResetButton({
  workshopId,
  userId,
  label,
}: {
  workshopId: string
  userId: string
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  function send() {
    setError("")
    startTransition(async () => {
      const res = await sendUserPasswordReset(workshopId, userId)
      if (res.ok) setSent(true)
      else setError(res.error || "Gönderilemedi")
    })
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Button
        size="sm"
        variant="outline"
        disabled={pending || sent}
        onClick={send}
        aria-label={`${label} için şifre sıfırlama bağlantısı gönder`}
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : sent ? (
          <Check className="size-3.5" />
        ) : (
          <KeyRound className="size-3.5" />
        )}
        {sent ? "Gönderildi" : "Şifre bağlantısı"}
      </Button>
      {error && <span className="text-xs text-destructive-strong text-right">{error}</span>}
    </div>
  )
}
