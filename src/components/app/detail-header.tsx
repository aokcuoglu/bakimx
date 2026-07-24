"use client"

import type { ComponentType, ReactNode } from "react"
import { ArrowLeft, Car, User, Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlateBadge } from "@/components/app/plate-badge"
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
    <div className="flex items-start gap-3 sm:items-center">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-lg touch-manipulation shrink-0"
          aria-label="Geri"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          {/* `items-start` sütun modunda çocukları içeriğe göre büyüttüğü için
              `truncate` tek başına devreye girmiyordu: uzun kurumsal müşteri adı
              üç nokta olmadan ekranın dışına taşıp kırpılıyordu. `max-w-full`
              çocuğu satır genişliğine bağlar ve kırpma düzgün çalışır. */}
          <div className="flex w-full flex-col items-start gap-1 min-w-0 sm:w-auto sm:flex-row sm:items-center sm:flex-nowrap sm:gap-2">
            <PlateBadge plate={plate} size="sm" className="shrink-0" />
            <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
            <span className="inline-flex max-w-full items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <Car className="size-3.5 shrink-0" />
              <span className="truncate">{vehicleLabel}</span>
            </span>
            <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
            <span className="inline-flex max-w-full items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{customerLabel}</span>
            </span>
            {meta && (
              <>
                <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
                {meta}
              </>
            )}
          </div>
          {/* Dar ekranda rozet + aksiyon tek satıra sığmayabilir; taşma yerine sarsın. */}
          <div className="flex flex-wrap items-center gap-2 max-w-full sm:shrink-0">
            {badges}
            {hasActions && (
              <div className="flex items-center gap-2">
                {primary && (
                  <Button
                    size="default"
                    variant="default"
                    onClick={primary.onClick}
                    disabled={loading}
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
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border transition-colors touch-manipulation hover:bg-muted disabled:opacity-50"
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
                              disabled={loading}
                              className={cn(
                                "gap-2",
                                isDanger && "text-destructive data-highlighted:text-destructive"
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
