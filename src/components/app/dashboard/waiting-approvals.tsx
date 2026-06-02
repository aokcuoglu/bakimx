import Link from "next/link"
import type { WaitingApprovalItem } from "@/lib/dashboard/queries"
import { ChevronRight, ExternalLink } from "lucide-react"
import { PlateBadge } from "@/components/app/status-badge"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function WaitingApprovals({ approvals }: { approvals: WaitingApprovalItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Onay Bekleyenler</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {approvals.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Onay bekleyen kayıt yok.
          </p>
        ) : (
          approvals.map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PlateBadge plate={a.plate} />
                    <span className="text-xs font-mono text-slate-400">{a.workOrderNo}</span>
                  </div>
                  <p className="text-sm text-slate-700 truncate">{a.customerName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(a.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Link
                  href={`/app/intakes/${a.intakeFormId}`}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-amber-100 hover:bg-amber-200 text-xs font-medium text-amber-800 transition-colors touch-manipulation"
                >
                  <ExternalLink className="size-3" />
                  Kabul Detayı
                </Link>
                <Link
                  href={`/app/orders/${a.id}`}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors touch-manipulation"
                >
                  <ChevronRight className="size-3" />
                  İş Emri
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
