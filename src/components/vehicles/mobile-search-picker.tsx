"use client"

import { useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { Check, ChevronDown, Loader2, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useVisualViewport } from "@/hooks/use-visual-viewport"
import { cn } from "@/lib/utils"

/**
 * Telefon düzeni: kontrollerin 44px'e büyüdüğü sınırla aynı (globals.css,
 * `--control-h` 768px altı). Sidebar'ın `useIsMobile`'ı (1024px) burada
 * kullanılmaz — tablette yerinde açılan liste klavyeyle sorunsuz sığar.
 */
const PHONE_QUERY = "(max-width: 767px)"

function subscribePhone(callback: () => void) {
  const mql = window.matchMedia(PHONE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function usePhoneLayout() {
  return useSyncExternalStore(
    subscribePhone,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  )
}

const trLower = (s: string) => s.trim().toLocaleLowerCase("tr")

/**
 * Telefonda aranabilir seçim listesi (marka/model). Yerinde açılan Combobox
 * listesi telefonda klavyenin altında kalıyor: iOS'ta klavye layout viewport'u
 * küçültmediği için liste yüksekliği klavyeyi hesaba katmıyor, sayfa da odaklı
 * alanı göstermek için kayıyor. Burada seçim tam ekran bir panelde yapılır:
 * arama en üstte, liste görünen alanın (visual viewport) altında — yani
 * klavyenin hemen üstünde — biter ve her satır kaydırılarak erişilebilir.
 *
 * Panel klavyeyi kendiliğinden AÇMAZ: liste önce tam görünür; yazmak isteyen
 * arama kutusuna dokunur. Listede olmayan değer "… kullan" satırıyla girilir
 * (Combobox'taki serbest metin davranışının karşılığı). Seçmeden kapatmak
 * mevcut değeri değiştirmez.
 */
export function MobileSearchPicker<T>({
  id,
  title,
  value,
  placeholder,
  disabled,
  items,
  getKey,
  getLabel,
  query,
  onQueryChange,
  loading = false,
  onSelect,
  onUseTyped,
}: {
  id?: string
  /** Panel başlığı ve tetikleyicinin erişilebilir adı ("Marka"). */
  title: string
  value: string
  placeholder: string
  disabled?: boolean
  /** Arama sorgusuna göre ZATEN süzülmüş öğeler (süzme yeri çağırana ait). */
  items: T[]
  getKey: (item: T) => string | number
  getLabel: (item: T) => string
  query: string
  onQueryChange: (query: string) => void
  loading?: boolean
  onSelect: (item: T) => void
  /** Listede olmayan, yazılmış değeri kullan. */
  onUseTyped: (text: string) => void
}) {
  const [open, setOpen] = useState(false)
  const viewport = useVisualViewport()

  const typed = query.trim()
  const exact = typed ? items.find((it) => trLower(getLabel(it)) === trLower(typed)) : undefined
  const showUseTyped = typed.length > 0 && !exact && !loading

  function openPicker() {
    onQueryChange("")
    setOpen(true)
  }

  function pick(item: T) {
    onSelect(item)
    setOpen(false)
  }

  function commitTyped() {
    onUseTyped(typed)
    setOpen(false)
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    e.preventDefault()
    if (exact) pick(exact)
    else if (items.length === 1 && !loading) pick(items[0])
    else if (typed) commitTyped()
  }

  return (
    <>
      <Button
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `${title}: ${value}` : title}
        onClick={openPicker}
        className="w-full justify-between rounded-[12px] border-input px-(--field-px) font-normal"
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
        <ChevronDown className="text-muted-foreground" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="top"
          // Klavye açılınca panel görünen alana sığsın (bkz. useVisualViewport).
          style={viewport ? { height: viewport.height, top: viewport.offsetTop } : { height: "100dvh" }}
          className="gap-0 border-0 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-3 border-b border-border p-4 pr-14">
            <SheetTitle>{title} seçin</SheetTitle>
            <SheetDescription className="sr-only">
              Listeden seçin ya da arayın; listede yoksa yazdığınız değeri kullanın.
            </SheetDescription>
          </div>
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={`${title} ara`}
                aria-label={`${title} ara`}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
                className="pl-9"
              />
            </div>
          </div>

          <div role="listbox" aria-label={title} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {showUseTyped && (
              <Button
                type="button"
                variant="ghost"
                role="option"
                aria-selected={false}
                onClick={commitTyped}
                className="h-11 w-full justify-start gap-2 rounded-lg px-3 text-foreground"
              >
                <Plus className="text-primary" />
                <span className="truncate">“{typed}” kullan</span>
              </Button>
            )}
            {items.map((item) => {
              const label = getLabel(item)
              const selected = trLower(label) === trLower(value)
              return (
                <Button
                  key={getKey(item)}
                  type="button"
                  variant="ghost"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(item)}
                  className={cn(
                    "h-11 w-full justify-between rounded-lg px-3 font-normal text-foreground",
                    selected && "font-medium",
                  )}
                >
                  <span className="truncate">{label}</span>
                  {selected && <Check className="text-primary" />}
                </Button>
              )
            })}
            {loading && (
              <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Yükleniyor…
              </p>
            )}
            {!loading && items.length === 0 && !typed && (
              <p className="px-3 py-3 text-sm text-muted-foreground">
                Liste boş — aramaya yazdığınız değeri kullanabilirsiniz.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
