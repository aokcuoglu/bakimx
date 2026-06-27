"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, RotateCw } from "lucide-react"

/**
 * App-segment error boundary. Catches uncaught errors from pages and server
 * actions (e.g. the read-only impersonation write-guard) and renders a clean
 * message instead of a crash. In dev, Next still shows its overlay on top.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error boundary]", error)
  }, [error])

  // The read-only message is preserved in dev; prod masks it to a generic string.
  const isReadOnly = error.message?.includes("Salt-okunur")

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="size-6 text-amber-600" />
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
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          <RotateCw className="size-4" /> Tekrar dene
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Panele dön
        </Link>
      </div>
    </div>
  )
}
