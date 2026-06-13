"use client"

import { ReportHeader, StatCard, ReportTable } from "@/components/app/reports/report-utils"
import { formatTRY } from "@/lib/format"

interface PartsReportProps {
  stats: {
    stockValue: number
    criticalStockCount: number
    outOfStockCount: number
    totalParts: number
  }
  mostUsed: {
    partId: string
    name: string
    sku: string | null
    totalUsed: number
  }[]
  lowestStock: {
    id: string
    name: string
    sku: string | null
    stockQty: number
    criticalStockQty: number
    salePrice: number | null
    status: "critical" | "out_of_stock"
  }[]
}

export function PartsReport({ stats, mostUsed, lowestStock }: PartsReportProps) {
  const csvHeaders = ["Parça", "Stok Kodu", "Stok", "Kritik Stok", "Satış Fiyatı", "Durum"]
  const csvRows = lowestStock.map((p) => [
    p.name,
    p.sku || "",
    p.stockQty,
    p.criticalStockQty,
    p.salePrice ?? "",
    p.status === "out_of_stock" ? "Tükendi" : "Kritik",
  ])

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Parça Raporu"
        description="Stok durumu, değer ve kullanım analizi"
        exportData={{ headers: csvHeaders, rows: csvRows, filename: "parca-raporu.csv" }}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Stok Değeri" value={stats.stockValue} accent="blue" isCurrency />
        <StatCard label="Toplam Parça" value={stats.totalParts} accent="indigo" />
        <StatCard label="Kritik Stok" value={stats.criticalStockCount} accent="amber" />
        <StatCard label="Tükenen Parça" value={stats.outOfStockCount} accent="red" />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">En Çok Kullanılan Parçalar</h4>
        <ReportTable
          headers={[
            { key: "name", label: "Parça" },
            { key: "sku", label: "Stok Kodu" },
            { key: "totalUsed", label: "Kullanım Sayısı" },
          ]}
          rows={mostUsed}
          renderRow={(row) => (
            <tr key={row.partId} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.sku || "—"}</td>
              <td className="px-4 py-2.5 font-semibold text-blue-700">{row.totalUsed}</td>
            </tr>
          )}
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">En Düşük Stoklu Parçalar</h4>
        <ReportTable
          headers={[
            { key: "name", label: "Parça" },
            { key: "sku", label: "Stok Kodu" },
            { key: "stockQty", label: "Stok" },
            { key: "criticalStockQty", label: "Kritik Eşik" },
            { key: "salePrice", label: "Satış Fiyatı" },
            { key: "status", label: "Durum" },
          ]}
          rows={lowestStock}
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">{row.name}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.sku || "—"}</td>
              <td className={`px-4 py-2.5 font-semibold ${row.status === "out_of_stock" ? "text-red-700" : "text-amber-700"}`}>
                {row.stockQty}
              </td>
              <td className="px-4 py-2.5 text-slate-600">{row.criticalStockQty}</td>
              <td className="px-4 py-2.5 text-slate-600">{row.salePrice != null ? formatTRY(row.salePrice) : "—"}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.status === "out_of_stock"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {row.status === "out_of_stock" ? "Tükendi" : "Kritik"}
                </span>
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  )
}