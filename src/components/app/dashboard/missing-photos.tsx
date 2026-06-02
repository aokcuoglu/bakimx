import Link from "next/link"
import type { MissingPhotoItem } from "@/lib/dashboard/queries"
import { Camera, ChevronRight } from "lucide-react"
import { PlateBadge } from "@/components/app/status-badge"

export function MissingPhotos({ items }: { items: MissingPhotoItem[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900">Eksik Fotoğraflar</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 text-center">
            Eksik fotoğraf bulunmuyor.
          </p>
        ) : (
          items.map((item) => (
            <Link
              key={item.orderId}
              href={`/app/intakes/${item.intakeFormId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="size-9 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                <Camera className="size-4 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <PlateBadge plate={item.plate} />
                  <span className="text-xs font-mono text-slate-400">{item.workOrderNo}</span>
                </div>
                <p className="text-sm text-slate-700 truncate">{item.customerName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold text-rose-600">-{item.missingCount}</span>
                <ChevronRight className="size-3.5 text-slate-300 mt-0.5 ml-auto" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
