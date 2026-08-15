"use client"

import { useState, useTransition } from "react"
import { AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { updateWorkshopBakimxDiscount } from "@/app/admin/actions"
import { bpsToPercent, percentToBps } from "@/lib/validations/bakimx-discount"

interface BakimxDiscountFormProps {
  workshopId: string
  currentDiscountBps: number
}

export function BakimxDiscountForm({ workshopId, currentDiscountBps }: BakimxDiscountFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [value, setValue] = useState(String(bpsToPercent(currentDiscountBps)))

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setServerError("")
    setSuccessMessage("")

    const numValue = Number(value)
    if (!Number.isFinite(numValue) || numValue < 0 || numValue > 100) {
      setServerError("İskonto %0 ile %100 arasında olmalıdır")
      return
    }

    startTransition(async () => {
      const discountBps = percentToBps(numValue)
      const result = await updateWorkshopBakimxDiscount(workshopId, discountBps)

      if (!result.ok) {
        setServerError(result.error)
      } else {
        setSuccessMessage(`İskonto %${numValue} olarak güncellendi`)
      }
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="discount-percent" className="text-sm font-medium">
            BakımX İskontosu (%)
          </label>
          <Input
            id="discount-percent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            0 ile 100 arasında. Ondalık sayılar desteklenir (örn: 15.5 = %15.5)
          </p>
        </div>

        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
          Güncelle
        </Button>
      </form>

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-success/20 bg-success/10">
          <AlertDescription className="text-success-strong">{successMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
