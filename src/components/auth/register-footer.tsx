import Link from "next/link"
import { cn } from "@/lib/utils"

export function RegisterFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card text-xs text-muted-foreground", className)}>
      <span>© 2026 BakimX · Servisiniz kontrol altında</span>
      <span className="flex flex-wrap gap-4">
        <Link href="/kvkk" target="_blank" className="hover:text-foreground hover:underline">KVKK</Link>
        <Link href="/privacy" target="_blank" className="hover:text-foreground hover:underline">Gizlilik</Link>
        <Link href="/terms" target="_blank" className="hover:text-foreground hover:underline">Kullanım Koşulları</Link>
      </span>
    </footer>
  )
}
