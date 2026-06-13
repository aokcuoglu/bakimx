"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { StatCard, ReportHeader, BarChart } from "@/components/app/reports/report-utils"
import { formatTRY } from "@/lib/format"

interface CollectionsReportProps {
  stats: {
    totalCollected: number
    totalReceivable: number
    overdueReceivable: number
    cashTotal: number
    creditCardTotal: number
    bankTransferTotal: number
    otherTotal: number
  }
  dailyCollections: { date: string; label: string; amount: number }[]
  monthlyCollections: { month: string; label: string; amount: number }[]
  filters: { dateFrom?: string; dateTo?: string }
}

export function CollectionsReport({ stats, dailyCollections, monthlyCollections, filters }: CollectionsReportProps) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || "")
  const [dateTo, setDateTo] = useState(filters.dateTo || "")

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    router.push(`/app/reports/collections?${params.toString()}`)
  }

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    router.push("/app/reports/collections")
  }

  const csvHeaders = ["Tarih", "Miktar"]
  const csvRows = dailyCollections.map((d) => [d.date, d.amount])

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Tahsilat Raporu"
        description="Tahsilat ve alacak durumuna göre finansal analiz"
        exportData={{ headers: csvHeaders, rows: csvRows, filename: "tahsilat-raporu.csv" }}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Toplam Tahsilat" value={stats.totalCollected} accent="green" isCurrency />
        <StatCard label="Açık Alacak" value={stats.totalReceivable} accent="amber" isCurrency />
        <StatCard label="Gecikmiş Alacak" value={stats.overdueReceivable} accent="red" isCurrency />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">Ödeme Yöntemine Göre Dağılım</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Nakit</p>
            <p className="text-lg font-bold text-emerald-700">{formatTRY(stats.cashTotal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Kredi Kartı</p>
            <p className="text-lg font-bold text-blue-700">{formatTRY(stats.creditCardTotal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Havale/EFT</p>
            <p className="text-lg font-bold text-purple-700">{formatTRY(stats.bankTransferTotal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-slate-500">Diğer</p>
            <p className="text-lg font-bold text-slate-700">{formatTRY(stats.otherTotal)}</p>
          </div>
        </div>
        {(stats.totalCollected > 0) && (
          <div className="mt-4 flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100">
            {stats.cashTotal > 0 && (
              <div
                className="bg-emerald-500 transition-all"
                style={{ width: `${(stats.cashTotal / stats.totalCollected) * 100}%` }}
              />
            )}
            {stats.creditCardTotal > 0 && (
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${(stats.creditCardTotal / stats.totalCollected) * 100}%` }}
              />
            )}
            {stats.bankTransferTotal > 0 && (
              <div
                className="bg-purple-500 transition-all"
                style={{ width: `${(stats.bankTransferTotal / stats.totalCollected) * 100}%` }}
              />
            )}
            {stats.otherTotal > 0 && (
              <div
                className="bg-slate-400 transition-all"
                style={{ width: `${(stats.otherTotal / stats.totalCollected) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Tarih Filtresi</h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Başlangıç</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Bitiş</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm"
            />
          </div>
          <button onClick={applyFilters} className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            Uygula
          </button>
          <button onClick={clearFilters} className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
            Temizle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <BarChart data={dailyCollections} label="Günlük Tahsilat (Son 14 Gün)" valueKey="amount" />
        <BarChart data={monthlyCollections} label="Aylık Tahsilat" valueKey="amount" />
      </div>
    </div>
  )
}