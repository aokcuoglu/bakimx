"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, Plus, Search } from "lucide-react"
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from "@/components/ui/autocomplete"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toTrUpper } from "@/lib/format"

const COMPANIES_ENDPOINT = "/api/customers/companies"

/** Liste öğesi: kayıtlı firma ya da yazılan adla yeni firma. */
type CompanyOption = { kind: "existing" | "create"; name: string }

const sameName = (a: string, b: string) => a.toLocaleUpperCase("tr-TR") === b.toLocaleUpperCase("tr-TR")

/**
 * Araç kabul kartındaki "Kurumsal" düğmesinin açtığı tam sayfa sheet. Firma adı
 * alanının altında atölyenin kayıtlı firmaları liste görünümünde durur ve
 * yazdıkça süzülür; listede yoksa en altta "Yeni firma oluştur: …" çıkar.
 * Kartta seçili olan firma ✓ ile işaretlidir. Seçim (dokunma ya da Enter)
 * hemen uygulanır ve sheet kapanır — ayrı bir Kaydet düğmesi yoktur. Kapatma
 * düğmesiyle çıkmak kartı değiştirmez. Seçim yalnız adı doldurur, müşteriyi o
 * firmanın kaydına bağlamaz.
 */
export function IntakeCompanySheet({
  open,
  onOpenChange,
  companyName,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Karttaki mevcut firma adı (sheet açılınca alana gelir). */
  companyName: string
  onSelect: (companyName: string) => void
}) {
  const [draft, setDraft] = useState(companyName)
  const [companies, setCompanies] = useState<string[]>([])
  const highlighted = useRef<CompanyOption | undefined>(undefined)

  // Her açılışta karttaki değerle başla ve öneri listesini tazele.
  useEffect(() => {
    if (!open) return
    let active = true
    const t = setTimeout(() => setDraft(companyName), 0)
    fetch(COMPANIES_ENDPOINT)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!active || !data || typeof data !== "object" || !("companies" in data)) return
        const list = (data as { companies: unknown }).companies
        if (Array.isArray(list)) setCompanies(list.filter((x): x is string => typeof x === "string"))
      })
      .catch(() => {})
    return () => { active = false; clearTimeout(t) }
  }, [open, companyName])

  const trimmed = draft.trim().replace(/\s+/g, " ")
  const options = useMemo<CompanyOption[]>(() => {
    const existing = companies.map((name) => ({ kind: "existing" as const, name }))
    // Yazılan ad kayıtlı bir firmayla birebir aynı değilse "yeni oluştur" en altta.
    if (trimmed && !companies.some((c) => sameName(c, trimmed))) {
      return [...existing, { kind: "create", name: trimmed }]
    }
    return existing
  }, [companies, trimmed])

  const commit = (name: string) => {
    const value = name.trim().replace(/\s+/g, " ")
    if (!value) return
    onSelect(value)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Tam sayfa: sağdan kayarak tüm ekranı kaplar (telefonda yeni sayfa
          gibi). İçerik masaüstünde okunur genişlikte ortalanır. */}
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:border-l-0 data-[side=right]:sm:max-w-none"
      >
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
          <SheetHeader className="pr-14">
            <SheetTitle>Kurumsal müşteri</SheetTitle>
            <SheetDescription>Kayıtlı bir firma seçin ya da yeni firma adı yazın.</SheetDescription>
          </SheetHeader>
          {/* Liste görünümü: firmalar alanın ALTINDA, sayfanın içinde satır
              satır durur (açılır pencere değil). Yazdıkça süzülür. */}
          <Autocomplete
            items={options}
            value={draft}
            inline
            open
            autoHighlight
            itemToStringValue={(o: CompanyOption) => o.name}
            // Satır içi (inline) modda Base UI seçimi onValueChange ile
            // bildirmiyor (tarayıcıda ölçüldü): dokunma öğenin onClick'iyle,
            // Enter vurgulu öğeyle uygulanır.
            onValueChange={(v: string) => setDraft(toTrUpper(v))}
            onItemHighlighted={(o: CompanyOption | undefined) => { highlighted.current = o }}
          >
            <div className="space-y-1.5 px-4 pb-3">
              <Label htmlFor="company-sheet-name">Firma adı *</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <AutocompleteInput
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return
                    e.preventDefault()
                    commit(highlighted.current?.name ?? trimmed)
                  }}
                  render={<Input id="company-sheet-name" autoComplete="off" placeholder="Firma ara ya da yeni ad yaz" autoFocus className="pl-9" />}
                />
              </div>
            </div>
            <AutocompleteEmpty className="px-4 py-6 text-center">
              Henüz kayıtlı firma yok — firma adını yazın.
            </AutocompleteEmpty>
            <AutocompleteList className="max-h-none min-h-0 flex-1 border-t border-border p-0">
              {(o: CompanyOption) => (
                <AutocompleteItem
                  key={`${o.kind}:${o.name}`}
                  value={o}
                  onClick={() => commit(o.name)}
                  className="min-h-12 cursor-pointer rounded-none border-b border-border py-3 pr-11 pl-4 text-base"
                >
                  {o.kind === "create" ? (
                    <span className="flex min-w-0 items-start gap-2 text-primary-strong">
                      <Plus className="mt-1 size-4 shrink-0" aria-hidden />
                      <span className="min-w-0 break-words">Yeni firma oluştur: “{o.name}”</span>
                    </span>
                  ) : (
                    <span className="min-w-0 break-words">{o.name}</span>
                  )}
                  {o.kind === "existing" && companyName && sameName(o.name, companyName) && (
                    <Check className="absolute right-4 size-5 text-primary" aria-label="Seçili" />
                  )}
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </Autocomplete>
        </div>
      </SheetContent>
    </Sheet>
  )
}
