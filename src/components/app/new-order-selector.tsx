"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Loader2 } from "lucide-react"
import { StatusBadge, PlateBadge } from "@/components/app/status-badge"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils-client"

type IntakeRow = {
  id: string
  status: string
  hasOrder: boolean
  orderId: string | null
  createdAt: string
  photosCount: number
  damageCount: number
  total: number
  customer: {
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
  vehicle: { plate: string; brand: string; model: string }
}

const ELIGIBLE_STATUSES = ["approved", "in_progress", "ready_for_delivery", "delivered"]

export function NewOrderSelector({ intakes }: { intakes: IntakeRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState("")

  const eligible = intakes.filter((i) => ELIGIBLE_STATUSES.includes(i.status) && !i.hasOrder)
  const others = intakes.filter((i) => !eligible.includes(i))

  const filtered = (list: IntakeRow[]) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(
      (i) =>
        i.vehicle.plate.toLowerCase().includes(q) ||
        (i.customer.type === "corporate"
          ? (i.customer.companyName || "").toLowerCase().includes(q)
          : (i.customer.fullName || `${i.customer.firstName ?? ""} ${i.customer.lastName ?? ""}`.trim()).toLowerCase().includes(q)) ||
        i.customer.phone.includes(q)
    )
  }

  async function handleSelect(intakeId: string) {
    setLoadingId(intakeId)
    setError("")
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeFormId: intakeId }),
      })
      const data = await res.json()
      if (data.success && data.id) {
        router.push(`/app/orders/${data.id}`)
      } else {
        setError(data.error || "İş emri oluşturulamadı")
        setLoadingId(null)
      }
    } catch {
      setError("Bir hata oluştu")
      setLoadingId(null)
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Plaka, müşteri veya telefon ile ara..."
          className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white"
        />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error}
        </div>
      )}

      {filtered(eligible).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">İş Emri Oluşturmaya Uygun</p>
          {filtered(eligible).map((i) => (
            <SelectableIntakeCard
              key={i.id}
              intake={i}
              loading={loadingId === i.id}
              onSelect={() => handleSelect(i.id)}
              actionLabel="İş Emri Oluştur"
            />
          ))}
        </div>
      )}

      {filtered(others).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3">Diğer Kabuller</p>
          {filtered(others).slice(0, 5).map((i) => (
            <SelectableIntakeCard
              key={i.id}
              intake={i}
              loading={false}
              onSelect={i.hasOrder && i.orderId ? () => router.push(`/app/orders/${i.orderId}`) : undefined}
              actionLabel={i.hasOrder ? "Mevcut İş Emrine Git" : "Önce Onaylayın"}
              disabled={!i.hasOrder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SelectableIntakeCard({
  intake,
  loading,
  onSelect,
  actionLabel,
  disabled,
}: {
  intake: IntakeRow
  loading: boolean
  onSelect?: () => void
  actionLabel: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || loading}
      className={cn(
        "w-full text-left flex items-center gap-3 p-3 rounded-lg border bg-white transition-all touch-manipulation",
        disabled
          ? "border-slate-100 bg-slate-50 opacity-70 cursor-not-allowed"
          : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
      )}
    >
      <div className="shrink-0">
        <PlateBadge plate={intake.vehicle.plate} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate">
          {intake.customer.type === "corporate"
            ? intake.customer.companyName || "Kurumsal Müşteri"
            : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"}
        </p>
        <p className="text-xs text-slate-500 truncate">
          {intake.vehicle.brand} {intake.vehicle.model} • {formatDate(intake.createdAt)}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <StatusBadge status={intake.status} />
          {intake.hasOrder && <span className="text-[11px] text-emerald-700 font-medium">İş emri var</span>}
        </div>
      </div>
      <div className="shrink-0 text-xs font-medium text-blue-600">
        {loading ? <Loader2 className="size-4 animate-spin" /> : actionLabel}
      </div>
    </button>
  )
}
