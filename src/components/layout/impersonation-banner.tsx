import { Eye } from "lucide-react"
import { stopImpersonation } from "@/app/admin/impersonation-actions"
import { Button } from "@/components/ui/button"

/** Persistent, unmissable banner shown while a founder is impersonating a
 *  workshop. Rendered at the very top of the app shell. */
export function ImpersonationBanner({ workshopName }: { workshopName: string }) {
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warning px-4 py-2 text-center text-xs font-medium text-warning-foreground sm:text-sm">
      <Eye className="size-4 shrink-0" />
      <span>
        Yönetici taklit modu — <strong>{workshopName}</strong> olarak görüntülüyorsunuz (salt-okunur).
      </span>
      <form action={stopImpersonation}>
        {/* `ghost` varyantı nötr bir yüzey varsayar; bant `bg-warning` olduğu için
            tint ve metin rengi warning-foreground üzerinden verilir. */}
        <Button
          type="submit"
          variant="ghost"
          size="xs"
          className="bg-warning-foreground/10 font-semibold text-warning-foreground underline-offset-2 hover:bg-warning-foreground/20 hover:text-warning-foreground"
        >
          Çık
        </Button>
      </form>
    </div>
  )
}
