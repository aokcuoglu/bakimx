"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function TechnicianOrderError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <Alert variant="destructive">
        <AlertTitle>Araç kabulü açılamadı</AlertTitle>
        <AlertDescription>Bağlantınızı kontrol edip yeniden deneyin. Girdiğiniz bilgiler silinmedi.</AlertDescription>
      </Alert>
      <Button variant="foreground" size="lg" onClick={reset}>Tekrar dene</Button>
    </div>
  )
}
