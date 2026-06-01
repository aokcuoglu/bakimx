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
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <Construction className="size-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{title} Yakında</h1>
            <p className="mt-2 text-slate-600">{description}</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 text-amber-800 px-3 py-1 text-xs font-medium border border-amber-200">
            <Sparkles className="size-3" />
            Bu özellik sonraki sürümlerde eklenecektir
          </div>
          <div className="pt-2">
            <Link href="/app" className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
              <ArrowLeft className="size-4" />
              Ana panele dön
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
