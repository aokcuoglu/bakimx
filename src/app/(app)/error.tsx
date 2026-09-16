"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error"

/**
 * App-segment error boundary. Catches uncaught errors from pages and server
 * actions (e.g. the read-only impersonation write-guard) and renders a clean
 * message instead of a crash. In dev, Next still shows its overlay on top.
 *
 * Deploy sonrası bayat chunk hatasını yakalarsa sayfayı bir kez yeniler
 * (cache/history temizlemeye gerek kalmadan kurtarır).
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isChunkLoadError(error) && reloadOnceForChunkError()) return
    console.error("[app error boundary]", error)
  }, [error])

  // The read-only message is preserved in dev; prod masks it to a generic string.
  const isReadOnly = error.message?.includes("Salt-okunur")

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 sm:px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-warning/15">
        <AlertTriangle className="size-6 text-warning-strong" />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold text-foreground">
          {isReadOnly ? "Salt-okunur mod" : "Bir şeyler ters gitti"}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {isReadOnly
            ? "Taklit (impersonation) oturumu salt-okunurdur — bu ekranda değişiklik yapılamaz."
            : "İşlem tamamlanamadı. Lütfen tekrar deneyin."}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={reset}
        >
          <RotateCw className="size-4" /> Tekrar dene
        </Button>
        <Button asChild variant="foreground">
          <Link href="/dashboard">Panele dön</Link>
        </Button>
      </div>
    </div>
  )
}
