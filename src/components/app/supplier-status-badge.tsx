import { cn } from "@/lib/utils"

export function SupplierStatusBadge({
  isActive,
  size = "sm",
  className,
}: {
  isActive: boolean
  size?: "sm" | "md"
  className?: string
}) {
  const label = isActive ? "Aktif" : "Pasif"
  const color = isActive
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : "bg-slate-100 text-slate-500 border-slate-200"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2.5 text-xs",
        color,
        className
      )}
    >
      {label}
    </span>
  )
}