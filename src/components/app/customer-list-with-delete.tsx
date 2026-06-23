"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { CustomerList, type CustomerRow } from "@/components/app/customer-list"
import { deleteCustomerAction } from "@/app/(app)/customers/actions"

export function CustomerListWithDelete({
  customers,
  initialFilters,
  kpis,
}: {
  customers: CustomerRow[]
  initialFilters: {
    q: string
    type: "" | "individual" | "corporate"
    tag: string
    source: string
  }
  kpis?: { total: number; newThisMonth: number; returning: number }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onDelete(id: string, label: string) {
    setError(null)
    if (!confirm(`"${label}" müşterisini silmek istediğinize emin misiniz?`)) return
    startTransition(async () => {
      const result = await deleteCustomerAction(id)
      if (result?.error) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      <CustomerList
        customers={customers}
        initialFilters={{
          q: initialFilters.q ?? "",
          type: initialFilters.type ?? "",
          tag: initialFilters.tag ?? "",
          source: initialFilters.source ?? "",
        }}
        kpis={kpis}
        onDelete={onDelete}
      />
      {pending ? (
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <Trash2 className="size-3 animate-pulse" />
          Siliniyor…
        </div>
      ) : null}
    </div>
  )
}
