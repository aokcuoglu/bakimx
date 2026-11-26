import { Eye } from "lucide-react"
import { stopImpersonation } from "@/app/admin/impersonation-actions"
import { Button } from "@/components/ui/button"

/** Persistent, unmissable banner shown while a founder is impersonating a
 *  workshop. Rendered at the very top of the app shell.
 *
 *  Yüksekliği SABİT (40px, tek satır): kabuktaki yapışkan öğeler (üst bar,
 *  araç kabulü çipleri ve rayı) bandın altında durmak için bu ölçüyü
 *  `--app-imp-h` olarak hesaba katar (app-shell.module.css, #913). Metin
 *  kaydırmaz, sığmazsa kırpılır; telefonda kısa metin. */
export function ImpersonationBanner({ workshopName }: { workshopName: string }) {
  return (
    <div className="sticky top-0 z-50 flex h-10 items-center justify-center gap-3 bg-warning px-4 text-xs font-medium text-warning-foreground sm:text-sm">
      <Eye className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        <span className="sm:hidden">
          Taklit: <strong>{workshopName}</strong> (salt-okunur)
        </span>
        <span className="hidden sm:inline">
          Yönetici taklit modu — <strong>{workshopName}</strong> olarak görüntülüyorsunuz (salt-okunur).
        </span>
      </span>
      <form action={stopImpersonation} className="shrink-0">
        {/* `ghost` varyantı nötr bir yüzey varsayar; bant `bg-warning` olduğu için
            tint ve metin rengi warning-foreground üzerinden verilir. */}
        <Button
          type="submit"
          variant="ghost"
          size="xs"
          className="bg-warning-foreground/10 text-warning-foreground underline-offset-2 hover:bg-warning-foreground/20 hover:text-warning-foreground"
        >
          Çık
        </Button>
      </form>
    </div>
  )
}
