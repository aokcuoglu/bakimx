"use client"

import { useState } from "react"
import { Loader2, Mail, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Kilit ekranından doğrulama e-postasını yeniden yollar (session-scoped endpoint). */
export function ResendVerifyButton() {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle")

  async function resend() {
    setState("loading")
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" })
      setState(res.ok ? "sent" : "error")
    } catch {
      setState("error")
    }
  }

  if (state === "sent") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-primary">
        <Check className="size-4" /> Doğrulama e-postası tekrar gönderildi.
      </p>
    )
  }

  return (
    <div className="space-y-2 text-center">
      <Button onClick={resend} disabled={state === "loading"} className="w-full">
        {state === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Gönderiliyor…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Mail className="size-4" /> Doğrulama e-postasını tekrar gönder
          </span>
        )}
      </Button>
      {state === "error" && (
        <p className="text-sm text-destructive-strong">Gönderilemedi. Lütfen birkaç dakika sonra tekrar deneyin.</p>
      )}
    </div>
  )
}
