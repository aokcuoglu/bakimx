import { Infinity as InfinityIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

/** Aktif ama dönem bitişi olmayan (süresiz) iş yeri işareti (#1040). */
export function IndefiniteAccessBadge() {
  return (
    <Badge variant="outline" className="text-[11px] bg-warning/10 text-warning-strong">
      <InfinityIcon data-icon="inline-start" /> Süresiz
    </Badge>
  )
}
