"use client"

import { generateCSV, downloadCSV } from "@/lib/reports/export"
import { formatTRY } from "@/lib/format"

interface ReportHeaderProps {
  title: string
  description?: string
  exportData?: {
    headers: string[]
    rows: (string | number | null)[][]
    filename: string
  }
}

export function ReportHeader({ title, description, exportData }: ReportHeaderProps) {
  const handleExport = () => {
    if (!exportData) return
    const csv = generateCSV(exportData.headers, exportData.rows)
    downloadCSV(csv, exportData.filename)
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {exportData && (
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV İndir
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Yazdır
        </button>
      </div>
    </div>
  )
}

export function StatCard({
  label,
  value,
  subValue,
  accent = "blue",
  isCurrency = false,
}: {
  label: string
  value: string | number
  subValue?: string
  accent?: "blue" | "green" | "amber" | "red" | "purple" | "indigo"
  isCurrency?: boolean
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
    purple: "bg-purple-100 text-purple-700",
    indigo: "bg-indigo-100 text-indigo-700",
  }

  const displayValue = isCurrency && typeof value === "number" ? formatTRY(value) : value

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[accent]?.split(" ")[1] || "text-slate-900"}`}>
        {displayValue}
      </p>
      {subValue && <p className="text-[11px] text-slate-400 mt-0.5">{subValue}</p>}
    </div>
  )
}

export function BarChart({ data, label, valueKey = "count" }: { data: { label: string; date?: string; month?: string; count?: number; amount?: number }[]; label: string; valueKey?: "count" | "amount" }) {
  const values = data.map((d) => d[valueKey] ?? 0)
  const maxVal = Math.max(1, ...values)
  const hasData = values.some((v) => v > 0)

  if (!hasData) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h4 className="text-sm font-semibold text-slate-900 mb-4">{label}</h4>
        <div className="flex items-center justify-center h-32 text-sm text-slate-400">Veri bulunmuyor.</div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h4 className="text-sm font-semibold text-slate-900 mb-4">{label}</h4>
      <div className="flex items-end gap-1.5 sm:gap-2 h-32 sm:h-40">
        {data.map((d, i) => {
          const val = d[valueKey] ?? 0
          const pct = (val / maxVal) * 100
          return (
            <div key={d.date || d.month || i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 truncate max-w-full">
                {valueKey === "amount" ? formatTRY(val) : val}
              </span>
              <div
                className="w-full rounded-t-md bg-blue-500 transition-all min-h-[4px]"
                style={{ height: `${Math.max(2, pct)}%` }}
              />
              <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate max-w-full">{d.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ReportTable<T extends Record<string, unknown>>({
  headers,
  rows,
  renderRow,
}: {
  headers: { key: string; label: string }[]
  rows: T[]
  renderRow: (row: T, idx: number) => React.ReactNode
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-400 text-center">Veri bulunmuyor.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              {headers.map((h) => (
                <th key={h.key} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, idx) => renderRow(row, idx))}
          </tbody>
        </table>
      </div>
    </div>
  )
}