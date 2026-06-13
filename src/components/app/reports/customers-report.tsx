"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { StatCard, ReportHeader, ReportTable } from "@/components/app/reports/report-utils"
import { formatTRY } from "@/lib/format"

interface CustomersReportProps {
  stats: {
    total: number
    newThisMonth: number
    returning: number
  }
  topBySpend: {
    customerId: string
    customerName: string
    customerPhone: string
    ordersCount: number
    totalSpent: number
  }[]
  mostVisited: {
    customerId: string
    customerName: string
    customerPhone: string
    visitCount: number
  }[]
  filters: { dateFrom?: string; dateTo?: string }
}

export function CustomersReport({ stats, topBySpend, mostVisited, filters }: CustomersReportProps) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || "")
  const [dateTo, setDateTo] = useState(filters.dateTo || "")

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    router.push(`/app/reports/customers?${params.toString()}`)
  }

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    router.push("/app/reports/customers")
  }

  const csvHeaders = ["Müşteri", "Telefon", "Sipariş Sayısı", "Toplam Harcama"]
  const csvRows = topBySpend.map((c) => [
    c.customerName,
    c.customerPhone,
    c.ordersCount,
    c.totalSpent,
  ])

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Müşteri Raporu"
        description="Müşteri bazlı harcama ve ziyaret analizi"
        exportData={{ headers: csvHeaders, rows: csvRows, filename: "musteri-raporu.csv" }}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Toplam Müşteri" value={stats.total} accent="blue" />
        <StatCard label="Yeni Müşteri" value={stats.newThisMonth} subValue="Bu ay" accent="green" />
        <StatCard label="Tekrar Eden" value={stats.returning} accent="purple" />
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

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">En Çok Harcayan Müşteriler</h4>
        <ReportTable
          headers={[
            { key: "customerName", label: "Müşteri" },
            { key: "customerPhone", label: "Telefon" },
            { key: "ordersCount", label: "Sipariş" },
            { key: "totalSpent", label: "Toplam Harcama" },
          ]}
          rows={topBySpend}
          renderRow={(row) => (
            <tr key={row.customerId} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">{row.customerName}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.customerPhone}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.ordersCount}</td>
              <td className="px-4 py-2.5 font-semibold text-slate-900">{formatTRY(row.totalSpent)}</td>
            </tr>
          )}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">En Çok Ziyaret Eden Müşteriler</h4>
        <ReportTable
          headers={[
            { key: "customerName", label: "Müşteri" },
            { key: "customerPhone", label: "Telefon" },
            { key: "visitCount", label: "Ziyaret Sayısı" },
          ]}
          rows={mostVisited}
          renderRow={(row) => (
            <tr key={row.customerId} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">{row.customerName}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.customerPhone}</td>
              <td className="px-4 py-2.5 font-semibold text-blue-700">{row.visitCount}</td>
            </tr>
          )}
        />
      </div>
    </div>
  )
}