"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { StatCard, ReportHeader, BarChart } from "@/components/app/reports/report-utils"
import { formatTRY } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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

      <div className="rounded-lg border border-border bg-white p-4 sm:p-6">
        <h4 className="text-sm font-semibold text-foreground mb-4">Ödeme Yöntemine Göre Dağılım</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Nakit</p>
            <p className="text-lg font-bold text-success">{formatTRY(stats.cashTotal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Kredi Kartı</p>
            <p className="text-lg font-bold text-primary">{formatTRY(stats.creditCardTotal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Havale/EFT</p>
            <p className="text-lg font-bold text-primary">{formatTRY(stats.bankTransferTotal)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Diğer</p>
            <p className="text-lg font-bold text-foreground">{formatTRY(stats.otherTotal)}</p>
          </div>
        </div>
        {(stats.totalCollected > 0) && (
          <div className="mt-4 flex gap-1 h-3 rounded-full overflow-hidden bg-muted">
            {stats.cashTotal > 0 && (
              <div
                className="bg-success transition-all"
                style={{ width: `${(stats.cashTotal / stats.totalCollected) * 100}%` }}
              />
            )}
            {stats.creditCardTotal > 0 && (
              <div
                className="bg-primary transition-all"
                style={{ width: `${(stats.creditCardTotal / stats.totalCollected) * 100}%` }}
              />
            )}
            {stats.bankTransferTotal > 0 && (
              <div
                className="bg-primary/70 transition-all"
                style={{ width: `${(stats.bankTransferTotal / stats.totalCollected) * 100}%` }}
              />
            )}
            {stats.otherTotal > 0 && (
              <div
                className="bg-muted transition-all"
                style={{ width: `${(stats.otherTotal / stats.totalCollected) * 100}%` }}
              />
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Tarih Filtresi</h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Başlangıç</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Bitiş</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button onClick={applyFilters} size="sm">
            Uygula
          </Button>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Temizle
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <BarChart data={dailyCollections} label="Günlük Tahsilat (Son 14 Gün)" valueKey="amount" />
        <BarChart data={monthlyCollections} label="Aylık Tahsilat" valueKey="amount" />
      </div>
    </div>
  )
}