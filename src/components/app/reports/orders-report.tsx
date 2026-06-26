"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { StatCard, ReportHeader, BarChart, ReportTable } from "@/components/app/reports/report-utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatTRY } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface OrdersReportProps {
  stats: {
    total: number
    open: number
    completed: number
    cancelled: number
  }
  dailyOrders: { date: string; label: string; count: number }[]
  monthlyOrders: { month: string; label: string; count: number }[]
  expensiveOrders: {
    id: string
    workOrderNo: string | null
    grandTotal: number
    status: string
    createdAt: string
    customerName: string
    plate: string
  }[]
  longestDuration: {
    id: string
    workOrderNo: string | null
    durationDays: number
    status: string
    createdAt: string
    completedAt: string | null
    customerName: string
    plate: string
  }[]
  technicians: { id: string; fullName: string }[]
  statusOptions: { value: string; label: string }[]
  filters: { dateFrom?: string; dateTo?: string; technician?: string; status?: string; customer?: string }
}

export function OrdersReport({
  stats,
  dailyOrders,
  monthlyOrders,
  expensiveOrders,
  longestDuration,
  technicians,
  statusOptions,
  filters,
}: OrdersReportProps) {
  const router = useRouter()
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || "")
  const [dateTo, setDateTo] = useState(filters.dateTo || "")
  const [technician, setTechnician] = useState(filters.technician || "")
  const [status, setStatus] = useState(filters.status || "")
  const [customer, setCustomer] = useState(filters.customer || "")

  const applyFilters = () => {
    const params = new URLSearchParams()
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)
    if (technician) params.set("technician", technician)
    if (status) params.set("status", status)
    if (customer) params.set("customer", customer)
    router.push(`/reports/orders?${params.toString()}`)
  }

  const clearFilters = () => {
    setDateFrom("")
    setDateTo("")
    setTechnician("")
    setStatus("")
    setCustomer("")
    router.push("/reports/orders")
  }

  const csvHeaders = ["İş Emri No", "Müşteri", "Plaka", "Tutar", "Durum", "Tarih"]
  const csvRows = expensiveOrders.map((o) => [
    o.workOrderNo || "",
    o.customerName,
    o.plate,
    o.grandTotal,
    o.status,
    o.createdAt,
  ])

  return (
    <div className="space-y-5">
      <ReportHeader
        title="İş Emri Raporu"
        description="İş emirlerinin durumu, süresi ve tutarına göre analiz"
        exportData={{ headers: csvHeaders, rows: csvRows, filename: "is-emri-raporu.csv" }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Toplam İş Emri" value={stats.total} accent="blue" />
        <StatCard label="Açık İş Emri" value={stats.open} accent="amber" />
        <StatCard label="Tamamlanan" value={stats.completed} accent="green" />
        <StatCard label="İptal" value={stats.cancelled} accent="red" />
      </div>

      <div className="rounded-lg border border-border bg-white p-4">
        <h4 className="text-sm font-semibold text-foreground mb-3">Filtreler</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Teknisyen</label>
            <Select
              value={technician}
              onValueChange={(v) => setTechnician(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tümü</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Durum</label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tümü</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={applyFilters} size="sm">
              Uygula
            </Button>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Temizle
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        <BarChart data={dailyOrders} label="Günlük İş Emirleri (Son 14 Gün)" valueKey="count" />
        <BarChart data={monthlyOrders} label="Aylık İş Emirleri" valueKey="count" />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">En Yüksek Tutarlı İş Emirleri</h4>
        <ReportTable
          headers={[
            { key: "workOrderNo", label: "İş Emri No" },
            { key: "customerName", label: "Müşteri" },
            { key: "plate", label: "Plaka" },
            { key: "grandTotal", label: "Tutar" },
            { key: "status", label: "Durum" },
            { key: "createdAt", label: "Tarih" },
          ]}
          rows={expensiveOrders}
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-muted">
              <td className="px-4 py-2.5 font-medium text-foreground">{row.workOrderNo || "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.customerName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.plate}</td>
              <td className="px-4 py-2.5 font-semibold text-foreground">{row.grandTotal > 0 ? formatTRY(row.grandTotal) : "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.status}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(row.createdAt)}</td>
            </tr>
          )}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">En Uzun Süren İş Emirleri</h4>
        <ReportTable
          headers={[
            { key: "workOrderNo", label: "İş Emri No" },
            { key: "customerName", label: "Müşteri" },
            { key: "plate", label: "Plaka" },
            { key: "durationDays", label: "Süre (Gün)" },
            { key: "status", label: "Durum" },
            { key: "createdAt", label: "Oluşturma" },
          ]}
          rows={longestDuration}
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-muted">
              <td className="px-4 py-2.5 font-medium text-foreground">{row.workOrderNo || "—"}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.customerName}</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.plate}</td>
              <td className="px-4 py-2.5 font-semibold text-warning">{row.durationDays} gün</td>
              <td className="px-4 py-2.5 text-muted-foreground">{row.status}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(row.createdAt)}</td>
            </tr>
          )}
        />
      </div>
    </div>
  )
}