import Link from "next/link"
import type { MissingPhotoItem } from "@/lib/dashboard/queries"
import { Camera, ChevronRight } from "lucide-react"
import { PlateBadge } from "@/components/app/status-badge"

export function MissingPhotos({ items }: { items: MissingPhotoItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Eksik Fotoğraflar</h3>
      </div>
      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Eksik fotoğraf bulunmuyor.
          </p>
        ) : (
          items.map((item) => (
            <Link
              key={item.orderId}
              href={`/app/intakes/${item.intakeFormId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="size-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Camera className="size-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <PlateBadge plate={item.plate} />
                  <span className="text-xs font-mono text-muted-foreground/70">{item.workOrderNo}</span>
                </div>
                <p className="text-sm text-foreground truncate">{item.customerName}</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-semibold text-destructive">-{item.missingCount}</span>
                <ChevronRight className="size-3.5 text-muted-foreground/50 mt-0.5 ml-auto" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
