"use client"

import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertCircle aria-hidden="true" />
        <AlertTitle>Durum sayfası yüklenemedi</AlertTitle>
        <AlertDescription>
          Olay kayıtları alınırken bir sorun oluştu. İnternet bağlantınızı kontrol edip yeniden deneyin.
        </AlertDescription>
      </Alert>
      <Button size="lg" onClick={reset}>Yeniden Dene</Button>
    </div>
  )
}
