"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteCustomerAction } from "@/app/app/customers/actions"

export function DeleteCustomerButton({
  customerId,
  customerLabel,
  size = "sm",
  variant = "outline",
}: {
  customerId: string
  customerLabel: string
  size?: "sm" | "default"
  variant?: "outline" | "destructive" | "ghost"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  function onConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await deleteCustomerAction(customerId)
      if (result?.error) {
        setError(result.error)
        setConfirming(false)
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="text-xs text-destructive font-medium" title={error || ""}>
          “{customerLabel}” silinsin mi?
        </span>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Siliniyor…" : "Onayla"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setConfirming(false)
            setError(null)
          }}
          disabled={pending}
        >
          Vazgeç
        </Button>
        {error ? <span className="text-xs text-destructive">{error}</span> : null}
      </span>
    )
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={() => setConfirming(true)}
      className="gap-1.5"
    >
      <Trash2 className="size-3.5" />
      Sil
    </Button>
  )
}
