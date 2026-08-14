"use client"

import { useState, useTransition } from "react"
import { Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { startImpersonation } from "@/app/admin/impersonation-actions"

/** Founder action to enter a read-only impersonation of a workshop. On success
 *  the server action redirects into the app; only errors return here. */
export function ImpersonateButton({ workshopId }: { workshopId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run() {
    setError("")
    startTransition(async () => {
      const res = await startImpersonation(workshopId)
      // A successful start redirects; reaching here means it returned an error.
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        disabled={pending}
        onClick={run}
        variant="outline"
        size="sm"
        aria-label="Bu iş yerini salt okunur müşteri görünümünde aç"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
        Müşteri gibi gör
      </Button>
      {error && <p className="text-xs text-destructive-strong">{error}</p>}
    </div>
  )
}
