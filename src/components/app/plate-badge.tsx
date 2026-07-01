import { cn } from "@/lib/utils"

function formatTurkishPlate(plate: string): string {
  const stripped = plate.replace(/\s+/g, "").toUpperCase()
  const cityCode = stripped.match(/^(\d{1,2})/)
  if (!cityCode) return plate.toUpperCase()
  const rest = stripped.slice(cityCode[1].length)
  const letters = rest.match(/^([A-ZÇĞİÖŞÜ]{1,3})/)
  if (!letters) return plate.toUpperCase()
  const numbers = rest.slice(letters[1].length)
  return `${cityCode[1]} ${letters[1]} ${numbers}`
}

export function PlateBadge({
  plate,
  className,
  size = "md",
}: {
  plate: string
  className?: string
  size?: "sm" | "md"
}) {
  const formatted = formatTurkishPlate(plate)

  return (
    <span
      className={cn(
        "inline-flex items-stretch rounded-md overflow-hidden border border-black/15 bg-white shadow-sm select-none",
        size === "sm" ? "h-6" : "h-8",
        className
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center bg-primary text-primary-foreground font-bold leading-none tracking-tight",
          size === "sm" ? "text-[8px] px-0.5" : "text-[9px] px-1"
        )}
      >
        TR
      </span>
      <span
        className={cn(
          "flex items-center justify-center bg-white text-black font-mono font-extrabold tracking-wider whitespace-nowrap",
          size === "sm" ? "text-[11px] px-1.5" : "text-[13px] px-2"
        )}
      >
        {formatted}
      </span>
    </span>
  )
}