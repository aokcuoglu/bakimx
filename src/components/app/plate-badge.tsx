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
  const parts = formatted.split(/\s+/)
  const cityCode = parts[0] || ""
  const letters = parts[1] || ""
  const numbers = parts.slice(2).join("")

  return (
    <span
      className={cn(
        "inline-flex items-stretch rounded-md overflow-hidden border-2 border-primary bg-card shadow-sm h-8",
        className
      )}
    >
      <span className="flex items-center justify-center bg-primary text-primary-foreground text-[11px] font-bold px-1.5 min-w-[1.5rem] tracking-tight">
        {cityCode}
      </span>
      <span className="flex items-center justify-center bg-card text-card-foreground font-mono text-[11px] font-extrabold px-1.5 tracking-wider">
        {letters}
      </span>
      {numbers && (
        <span className="flex items-center justify-center bg-primary text-primary-foreground text-[11px] font-bold px-1.5 min-w-[1.5rem] tracking-tight">
          {numbers}
        </span>
      )}
    </span>
  )
}