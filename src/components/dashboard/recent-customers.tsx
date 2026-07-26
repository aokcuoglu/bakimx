import Link from "next/link"
import type { RecentCustomer } from "@/lib/dashboard/queries"
import { User, ChevronRight } from "lucide-react"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function RecentCustomers({ customers }: { customers: RecentCustomer[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Son Müşteriler</h3>
      </div>
      <div className="divide-y divide-border">
        {customers.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">
            Henüz müşteri kaydı yok.
          </p>
        ) : (
          customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
            >
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <User className="size-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground/70">{c.phone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground/70">{formatDate(c.createdAt)}</p>
                <ChevronRight className="size-3.5 text-muted-foreground/50 ml-auto mt-0.5" />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
