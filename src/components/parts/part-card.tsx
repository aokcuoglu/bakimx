import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * Projenin ortak PARÇA KARTI (BAK-84).
 *
 * Tek bir parçanın listede nasıl göründüğünü tarif eder: adı ve miktarı üstte,
 * hemen altında mono parça numarası + marka, sağ üstte durum/tutar, en altta
 * ikincil bilgi ve aksiyonlar. Şekil "Parça Talepleri" listesinden gelir —
 * dış alım listesi (`Dışarıdan Alınan Parçalar`) de aynı kartı kullanır, böylece
 * usta iki bölümde aynı bilgiyi aynı yerde okur.
 *
 * Bilerek "aptal" bir kabuk: veri çekmez, aksiyon bilmez. Her çağıran kendi
 * rozetini ve butonlarını verir; ortak olan yalnız yerleşim.
 */
export function PartCard({
  name,
  quantity,
  partNo,
  brand,
  note,
  badge,
  media,
  meta,
  actions,
  className,
}: {
  name: string
  /** Dolu ise adın yanında "×2" olarak çıkar; 1 adet de gösterilir (talep kartı böyle). */
  quantity?: number | null
  partNo?: string | null
  brand?: string | null
  /** Serbest not satırı — parça numarasının altında. */
  note?: ReactNode
  /** Sağ üst: durum rozeti ya da tutar. */
  badge?: ReactNode
  /** Ad satırının altında tam genişlik alan: fotoğraf şeridi gibi görsel ekler. */
  media?: ReactNode
  /** Alt satırın solu: tarih, kaynak gibi ikincil bilgi. */
  meta?: ReactNode
  /** Alt satırın sağı: düzenle/sil/durum butonları. */
  actions?: ReactNode
  className?: string
}) {
  const hasFooter = !!meta || !!actions
  return (
    <div className={cn("rounded-lg bg-muted px-3 py-2.5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground break-words">
            {name}
            {quantity != null && <span className="ml-1.5 text-xs text-muted-foreground">×{quantity}</span>}
          </p>
          {(partNo || brand) && (
            <p className="text-xs text-muted-foreground break-words">
              {partNo && <span className="font-mono">{partNo}</span>}
              {brand && (
                <>
                  {partNo ? " · " : ""}
                  {brand}
                </>
              )}
            </p>
          )}
          {note && <div className="text-xs text-muted-foreground mt-0.5 break-words">{note}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {media && <div className="mt-2">{media}</div>}

      {hasFooter && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">{meta}</span>
          {actions && <div className="flex items-center gap-1">{actions}</div>}
        </div>
      )}
    </div>
  )
}
