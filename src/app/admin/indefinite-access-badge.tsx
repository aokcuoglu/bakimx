import { Infinity as InfinityIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

/** Aktif ama dönem bitişi olmayan (süresiz) iş yeri işareti (#1040). */
export function IndefiniteAccessBadge() {
  return (
    <Badge variant="warning-tint" className="text-[11px]">
      <InfinityIcon data-icon="inline-start" /> Süresiz
    </Badge>
  )
}
