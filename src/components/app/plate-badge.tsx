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

export function PlateBadge({ plate, className }: { plate: string; className?: string }) {
  const formatted = formatTurkishPlate(plate)

  return (
    <span
      className={cn(
        "inline-flex items-stretch rounded-md overflow-hidden border border-black/15 bg-white shadow-sm h-8 select-none",
        className
      )}
    >
      <span className="flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold leading-none px-1 tracking-tight">
        TR
      </span>
      <span className="flex items-center justify-center bg-white text-black font-mono text-[13px] font-extrabold px-2 tracking-wider whitespace-nowrap">
        {formatted}
      </span>
    </span>
  )
}