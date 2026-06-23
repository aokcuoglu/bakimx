"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { StatCard, ReportHeader, ReportTable } from "@/components/app/reports/report-utils"
import { formatTRY } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

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
    router.push(`/reports/customers?${params.toString()}`)
  }

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    router.push("/reports/customers")
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

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">En Çok Harcayan Müşteriler</h4>
        <ReportTable
          headers={[
            { key: "customerName", label: "Müşteri" },
            { key: "customerPhone", label: "Telefon" },
            { key: "ordersCount", label: "Sipariş" },
            { key: "totalSpent", label: "Toplam Harcama" },
          ]}
          rows={topBySpend}
          renderRow={(row) => (
            <tr key={row.customerId} className="hover:bg-muted">
              <td className="px-4 py-2.5 font-medium text-foreground">{row.customerName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.customerPhone}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.ordersCount}</td>
              <td className="px-4 py-2.5 font-semibold text-foreground">{formatTRY(row.totalSpent)}</td>
            </tr>
          )}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">En Çok Ziyaret Eden Müşteriler</h4>
        <ReportTable
          headers={[
            { key: "customerName", label: "Müşteri" },
            { key: "customerPhone", label: "Telefon" },
            { key: "visitCount", label: "Ziyaret Sayısı" },
          ]}
          rows={mostVisited}
          renderRow={(row) => (
            <tr key={row.customerId} className="hover:bg-muted">
              <td className="px-4 py-2.5 font-medium text-foreground">{row.customerName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.customerPhone}</td>
              <td className="px-4 py-2.5 font-semibold text-primary">{row.visitCount}</td>
            </tr>
          )}
        />
      </div>
    </div>
  )
}