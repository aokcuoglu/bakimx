import { PlateBadge } from "@/components/app/plate-badge"
import { cn } from "@/lib/utils"

export function VehicleIdentity({
  plate,
  brand,
  model,
  className,
}: {
  plate: string
  brand: string
  model: string
  className?: string
}) {
  return (
    <div className={cn("min-w-0 flex items-center gap-2.5 flex-wrap", className)}>
      <PlateBadge plate={plate} />
      <h2 className="text-lg sm:text-xl font-bold text-foreground truncate">
        {brand} {model}
      </h2>
    </div>
  )
}
