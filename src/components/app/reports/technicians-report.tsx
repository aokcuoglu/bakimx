"use client"

import { ReportHeader, StatCard, ReportTable } from "@/components/app/reports/report-utils"

interface TechniciansReportProps {
  stats: {
    totalAssigned: number
    totalCompleted: number
    avgCompletionDays: number | null
  }
  performance: {
    id: string
    fullName: string
    role: string
    assignedJobs: number
    completedJobs: number
    avgCompletionDays: number | null
    activeJobs: number
  }[]
  roleLabels: Record<string, string>
}

export function TechniciansReport({ stats, performance, roleLabels }: TechniciansReportProps) {
  const csvHeaders = ["Teknisyen", "Rol", "Atanan İş", "Tamamlanan", "Aktif İş", "Ort. Tamamlama (Gün)"]
  const csvRows = performance.map((p) => [
    p.fullName,
    roleLabels[p.role] || p.role,
    p.assignedJobs,
    p.completedJobs,
    p.activeJobs,
    p.avgCompletionDays != null ? p.avgCompletionDays : "",
  ])

  return (
    <div className="space-y-5">
      <ReportHeader
        title="Teknisyen Raporu"
        description="Teknisyen performans ve iş yükü analizi"
        exportData={{ headers: csvHeaders, rows: csvRows, filename: "teknisyen-raporu.csv" }}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Toplam Atanan İş" value={stats.totalAssigned} accent="blue" />
        <StatCard label="Tamamlanan İş" value={stats.totalCompleted} accent="green" />
        <StatCard
          label="Ort. Tamamlama Süresi"
          value={stats.avgCompletionDays != null ? `${stats.avgCompletionDays} gün` : "—"}
          accent="purple"
        />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-slate-900 mb-3">Teknisyen Performans Tablosu</h4>
        <ReportTable
          headers={[
            { key: "fullName", label: "Teknisyen" },
            { key: "role", label: "Rol" },
            { key: "assignedJobs", label: "Atanan İş" },
            { key: "completedJobs", label: "Tamamlanan" },
            { key: "activeJobs", label: "Aktif İş" },
            { key: "avgCompletionDays", label: "Ort. Süre" },
          ]}
          rows={performance}
          renderRow={(row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-2.5 font-medium text-slate-900">{row.fullName}</td>
              <td className="px-4 py-2.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {roleLabels[row.role] || row.role}
                </span>
              </td>
              <td className="px-4 py-2.5 text-slate-600">{row.assignedJobs}</td>
              <td className="px-4 py-2.5 font-semibold text-emerald-700">{row.completedJobs}</td>
              <td className="px-4 py-2.5 font-semibold text-amber-700">{row.activeJobs}</td>
              <td className="px-4 py-2.5 text-slate-600">
                {row.avgCompletionDays != null ? `${row.avgCompletionDays} gün` : "—"}
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  )
}