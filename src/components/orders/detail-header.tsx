"use client"

import type { ComponentType, ReactNode } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plate } from "@/components/shared/plate"
import { detectPlate } from "@/lib/plate/country"
import { splitHeaderActions } from "@/lib/orders/header-actions"
import { cn } from "@/lib/utils"
import { detail } from "./order-detail-surface"

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
 *   kimlik  — breadcrumb + plaka rozeti + araç + müşteri + (opsiyonel) `meta`
 *   durum   — `pills`, yalnız okunacak haplar
 *   aksiyon — tek birincil buton + `⋯` taşma menüsü
 *
 * Aksiyonlar eskiden hepsi yan yana buton olarak çıkıyordu; rozetler de aynı
 * satırdaydı. Bu, bilgi ile eylemi görsel olarak eşitleyip hiyerarşiyi
 * bozuyordu. Artık yalnız birincil geçiş buton; kalanı menüye iner.
 * Sticky dip bar YOK (bkz. PR #86 konvansiyonu).
 */
export function DetailHeader({
  plate,
  title,
  subline,
  backHref,
  backLabel = "Araç Kabulleri",
  pills,
  meta,
  actions = [],
  loading = false,
}: {
  plate: string
  title: string
  /** Başlığın altındaki bağlam metni (ör. müşteri · model yılı). */
  subline: string
  backHref: string
  backLabel?: string
  /** Durum / ödeme hapları — yalnız okunur. */
  pills?: ReactNode
  /** Kimlik bloğuna eklenen ek bilgi (ör. atanan usta) — hap değil, meta dilinde. */
  meta?: ReactNode
  actions?: DetailHeaderAction[]
  loading?: boolean
}) {
  const { primary, overflow } = splitHeaderActions(actions)
  const hasActions = Boolean(primary) || overflow.length > 0

  return (
    <header className={detail.header}>
      <nav aria-label="Sayfa yolu" className={detail.crumb}>
        <Link href={backHref} className={cn(detail.crumbLink, detail.hit)}>
          {backLabel}
        </Link>
        <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        <span aria-current="page" className={detail.crumbCurrent}>
          {detectPlate(plate).text}
        </span>
      </nav>
      <div className={detail.titleRow}>
        <Plate plate={plate} size="lg" />
        <h1 className={detail.title}>{title}</h1>
      </div>
      {hasActions && (
        <div className={detail.actions}>
          {primary && (
            <Button
              variant="default"
              size="lg"
              className={detail.primaryAction}
              onClick={primary.onClick}
              disabled={loading || primary.disabled}
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
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="secondary" size="icon" aria-label="Diğer işlemler" disabled={loading}>
                  <MoreHorizontal />
                </Button>
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
      <div className={detail.sub}>
        <span className={detail.subText}>{subline}</span>
        {pills}
        {meta}
      </div>
    </header>
  )
}
