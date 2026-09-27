"use client"

import type { ComponentType, ReactNode } from "react"
import { ArrowLeft, Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { splitHeaderActions } from "@/lib/orders/header-actions"
import { cn } from "@/lib/utils"

export type DetailHeaderAction = {
  key: string
  label: string
  onClick: () => void
  tone: "primary" | "secondary" | "danger"
  icon?: ComponentType<{ className?: string }>
  /**
   * Aksiyon şu an yapılamıyor (ör. teslim için eksik fiyat). Gerekçe başlıkta
   * değil, başlığın altındaki uyarı şeridinde anlatılır — başlık üç katmanını
   * korur, açıklama metni taşımaz.
   */
  disabled?: boolean
}

/**
 * Detay sayfası başlığı (şu an yalnız İş Emri kullanıyor).
 *
 * Üç katman taşır ve bu ayrımı korumak başlığın okunabilirliğinin tamamı:
 *   kimlik  — geri + plaka + araç + müşteri + (opsiyonel) `meta`
 *   durum   — `badges`, yalnız okunacak rozetler
 *   aksiyon — tek birincil buton + `⋯` taşma menüsü
 *
 * Aksiyonlar eskiden hepsi yan yana buton olarak çıkıyordu; rozetler de aynı
 * satırdaydı. Bu, bilgi ile eylemi görsel olarak eşitleyip hiyerarşiyi
 * bozuyordu. Artık yalnız birincil geçiş buton; kalanı menüye iner.
 * Sticky dip bar YOK (bkz. PR #86 konvansiyonu).
 */
export function DetailHeader({
  plate,
  vehicleLabel,
  customerLabel,
  meta,
  badges,
  actions = [],
  loading = false,
  onBack,
}: {
  plate: string
  vehicleLabel: string
  customerLabel: string
  /** Kimlik bloğuna eklenen ek bilgi (ör. atanan usta) — rozet değil, meta dilinde. */
  meta?: ReactNode
  badges?: ReactNode
  actions?: DetailHeaderAction[]
  loading?: boolean
  onBack: () => void
}) {
  const { primary, overflow } = splitHeaderActions(actions)
  const hasActions = Boolean(primary) || overflow.length > 0

  return (
    <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ml-2 text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            İş emirleri
          </Button>
          <h1 className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">{plate}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {vehicleLabel}
            <span className="px-1.5 text-muted-foreground/40">·</span>
            {customerLabel}
          </p>
          {meta ? <div className="mt-1">{meta}</div> : null}
        </div>
        <div className="flex min-w-0 flex-col items-end gap-1.5">
          {/* Dar ekranda rozet + aksiyon tek satıra sığmayabilir; taşma yerine sarsın. */}
          <div className="flex flex-wrap items-center justify-end gap-2 max-w-full">
            {badges}
            {hasActions && (
              <div className="flex items-center gap-2">
                {primary && (
                  <Button
                    size="compact"
                    variant="outline"
                    onClick={primary.onClick}
                    disabled={loading || primary.disabled}
                    className="text-sm"
                  >
                    {loading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : primary.icon ? (
                      <primary.icon className="size-4" />
                    ) : null}
                    {primary.label}
                  </Button>
                )}
                {overflow.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={loading}
                      aria-label="Diğer işlemler"
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background transition-colors touch-manipulation hover:bg-muted disabled:opacity-50"
                    >
                      <MoreHorizontal className="size-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {overflow.map((a, i) => {
                        const Icon = a.icon
                        const isDanger = a.tone === "danger"
                        // Yıkıcı işlem menünün altında ve ayrık dursun ki
                        // yanlışlıkla dokunulmasın.
                        const needsSeparator = isDanger && i > 0 && overflow[i - 1].tone !== "danger"
                        return (
                          <div key={a.key}>
                            {needsSeparator && <DropdownMenuSeparator />}
                            <DropdownMenuItem
                              onClick={a.onClick}
                              disabled={loading || a.disabled}
                              className={cn(
                                "gap-2",
                                isDanger && "text-destructive-strong data-highlighted:text-destructive-strong"
                              )}
                            >
                              {Icon && <Icon className="size-4" />}
                              {a.label}
                            </DropdownMenuItem>
                          </div>
                        )
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        </div>
    </div>
  )
}
