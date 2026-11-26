"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, ListFilter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

/**
 * Araç Kabulleri arama + filtre alanı: arama kutusu boydan boya, filtreler
 * varsayılan kapalı; kutunun sağındaki "Filtreler" düğmesi açar. Etkin filtre
 * sayısı düğmede görünür, böylece kapalıyken de listenin süzüldüğü bellidir.
 *
 * Kapalı filtreler DOM'dan çıkarılmaz, yalnız gizlenir (`keepMounted`): form
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

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        {search}
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            // Beyaz arama kutusunun içindeki nötr dolgulu çip (#889): `xs` kutudan
            // (44/36px) her iki yanda boşluk bırakır; açık durum Radix aria-expanded ile.
            variant="secondary"
            size="xs"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 gap-1.5"
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
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent keepMounted className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
