"use client"

import { useState, useTransition } from "react"
import { Loader2, ShieldOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { revokeImpersonation } from "@/app/admin/impersonation-actions"

/**
 * Başkasının açık taklit oturumunu kesme düğmesi. Sunucu yetkiyi (`impersonate`)
 * her çağrıda yeniden doğrular; burası yalnız UX'tir.
 */
export function RevokeImpersonationButton({
  sessionId,
  label,
}: {
  sessionId: string
  label: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run() {
    setError("")
    startTransition(async () => {
      const res = await revokeImpersonation(sessionId)
      if (!res.ok) {
        setError(res.error)
        toast.error(res.error)
      } else {
        toast.success("Taklit oturumu iptal edildi")
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={run}
        aria-label={`${label} taklit oturumunu iptal et`}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
        İptal et
      </Button>
      {error && <p className="text-xs text-destructive-strong">{error}</p>}
    </div>
  )
}
