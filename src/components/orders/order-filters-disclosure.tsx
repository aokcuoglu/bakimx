"use client"

import { useId, useState, type ReactNode } from "react"
import { ChevronDown, ListFilter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Araç Kabulleri arama + filtre alanı: arama kutusu boydan boya, filtreler
 * varsayılan kapalı; kutunun sağındaki "Filtreler" düğmesi açar. Etkin filtre
 * sayısı düğmede görünür, böylece kapalıyken de listenin süzüldüğü bellidir.
 *
 * Kapalı filtreler DOM'dan çıkarılmaz, yalnız gizlenir (`hidden`): form
 * gönderilince (ör. arama) seçili filtre değerleri de gitmeli.
 */
export function OrderFiltersDisclosure({
  search,
  activeCount,
  children,
}: {
  /** Arama alanı (sunucuda çizilen `<Input name="q">`). */
  search: ReactNode
  activeCount: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        {search}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "absolute right-1.5 top-1/2 h-8 -translate-y-1/2 gap-1.5 rounded-full bg-card px-3 text-[13px] font-medium text-foreground hover:bg-card",
            open && "text-primary-strong",
          )}
        >
          <ListFilter aria-hidden="true" />
          Filtreler
          {activeCount > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-5 text-primary-foreground">
              {activeCount}
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </div>
      <div id={panelId} hidden={!open} className="pt-3">
        {children}
      </div>
    </div>
  )
}
