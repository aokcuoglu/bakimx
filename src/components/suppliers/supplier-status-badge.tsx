import { StatusPill } from "@/components/shared/status-badge"

export function SupplierStatusBadge({
  isActive,
  size = "sm",
  className,
}: {
  isActive: boolean
  size?: "sm" | "md"
  className?: string
}) {
  return (
    <StatusPill
      label={isActive ? "Aktif" : "Pasif"}
      tone={isActive ? "success" : "neutral"}
      size={size}
      className={className}
    />
  )
}
