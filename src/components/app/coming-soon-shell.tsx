"use client"

import Link from "next/link"
import { Construction, ArrowLeft, Sparkles } from "lucide-react"
import { AppShell } from "@/components/app/app-shell"

export function ComingSoonShell({
  title,
  description,
  workshopName,
}: {
  title: string
  description: string
  workshopName?: string
}) {
  return (
    <AppShell workshopName={workshopName} pageTitle={title}>
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Construction className="size-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title} Yakında</h1>
            <p className="mt-2 text-muted-foreground">{description}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-warning/10 text-foreground px-3 py-1 text-xs font-medium border border-warning/20">
            <Sparkles className="size-3" />
            Bu özellik sonraki sürümlerde eklenecektir
          </div>
          <div className="pt-2">
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" />
              Ana panele dön
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
