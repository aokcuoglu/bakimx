import { Eye } from "lucide-react"
import { stopImpersonation } from "@/app/admin/impersonation-actions"

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
        <button
          type="submit"
          className="rounded-md bg-warning-foreground/10 px-2.5 py-1 font-semibold underline-offset-2 hover:bg-warning-foreground/20"
        >
          Çık
        </button>
      </form>
    </div>
  )
}
