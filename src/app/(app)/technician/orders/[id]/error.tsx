"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function TechnicianOrderError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <Alert variant="destructive">
        <AlertTitle>İş emri açılamadı</AlertTitle>
        <AlertDescription>Bağlantınızı kontrol edip yeniden deneyin. Girdiğiniz bilgiler silinmedi.</AlertDescription>
      </Alert>
      <Button size="lg" onClick={reset}>Tekrar dene</Button>
    </div>
  )
}
