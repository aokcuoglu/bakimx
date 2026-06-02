import { cn } from "@/lib/utils"

export function PlateBadge({ plate, className }: { plate: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[5rem] h-7 px-2.5 rounded-md bg-[#0B1F3A] text-white font-mono text-xs font-semibold tracking-wider shadow-sm",
        className
      )}
    >
      {plate}
    </span>
  )
}
