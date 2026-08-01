"use client"

import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Yanlış çekilen kareyi galeriden kaldırır. Silme sunucuda SOFT'tur (kayıt ve
 * dosya denetim için korunur, yalnızca görünürden düşer) — onay metni bunu
 * kullanıcıya olduğu gibi söyler, "kalıcı silindi" izlenimi vermez.
 *
 * `variant="overlay"` galeri kartının köşesine binen küçük yuvarlak buton,
 * `variant="inline"` normal akış içinde duran metinli buton.
 */
export function PhotoDeleteButton({
  photoId,
  photoLabel,
  onDeleted,
  variant = "overlay",
  className,
}: {
  photoId: string
  photoLabel?: string | null
  onDeleted?: () => void
  variant?: "overlay" | "inline"
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  async function confirmDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/intakes/photos?id=${encodeURIComponent(photoId)}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error || "Fotoğraf silinemedi")
        return
      }
      setOpen(false)
      toast.success("Fotoğraf kaldırıldı")
      onDeleted?.()
    } catch {
      toast.error("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {variant === "overlay" ? (
        <button
          type="button"
          aria-label={photoLabel ? `${photoLabel} fotoğrafını sil` : "Fotoğrafı sil"}
          // Kart tıklaması lightbox açıyor; sil butonu onu tetiklememeli.
          onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-1.5 right-1.5 z-10 inline-flex size-8 items-center justify-center rounded-full",
            "bg-background/85 text-destructive ring-1 ring-border backdrop-blur-sm",
            "transition-colors hover:bg-destructive hover:text-destructive-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation",
            className
          )}
        >
          <Trash2 className="size-4" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn("text-destructive", className)}
        >
          <Trash2 className="size-3.5" />
          Fotoğrafı sil
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o) }}>
        {/* Portal içeriği DOM'da dışarıda dursa da React olayları REACT ağacını
            izler: buradaki tıklama, bileşeni saran galeri kartının onClick'ine
            kadar kabarır ve silmeden hemen sonra lightbox açardı. */}
        <AlertDialogContent
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Fotoğraf silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {photoLabel ? `"${photoLabel}" karesi ` : "Bu kare "}
              galeriden, PDF&apos;ten ve müşteriyle paylaşılan sayfadan kaldırılacak. Kayıt,
              denetim izi için sistemde saklanmaya devam eder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
