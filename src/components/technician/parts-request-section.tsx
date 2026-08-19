"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  CheckCircle2, Info, Minus, Package, PackageSearch, Plus, Send,
  TriangleAlert, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { formatKurus } from "@/lib/money"
import { PARTS_REQUEST_STATUS } from "@/lib/constants"
import { PartSearchInput } from "@/components/parts/part-search-input"
import { PartCard } from "@/components/parts/part-card"
import { PartDetailDialog, type PartDetailTarget } from "@/components/parts/part-detail-dialog"
import { TecdocPartPicker, type PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import { ensureVehiclePartsPrefetched } from "@/app/(app)/parts/actions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { StockPartLite } from "@/lib/parts/suggestions"
import type { PartsRequestTypeKey } from "@/lib/validations/technician"
import { createPartsRequestAction, updatePartsRequestStatusAction } from "@/app/(app)/technician/actions"

export type TechnicianPartsRequest = {
  id: string
  /** "part" | "external_labor" — dış işçilik talebinde katalog alanları boştur. */
  type: string
  partName: string
  partSku: string | null
  brand: string | null
  tecdocArticleId: number | null
  quantity: number
  note: string | null
  status: string
  convertedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  /** Dış işçilikte işi yapan firma; parça talebinde null. */
  supplierName: string | null
  /** Dış işçilikte teknisyenin bildirdiği tahmini tutar (kuruş); parça talebinde null. */
  estimatedPriceKurus: number | null
  createdAt: string
}

/**
 * Teknisyenin sahadan gönderdiği parça talepleri: aracın KATALOG parçalarında
 * arayıp talep etme + gönderilmiş taleplerin durumu.
 *
 * Tasarım iş emrindeki "Kullanılan Parçalar" kutusuyla aynı omurgayı kullanır
 * (PartSearchInput + TecDoc picker + parça detay modalı): usta orada gördüğü
 * araca özel listeyi burada da görür, serbest metin yazmak zorunda kalmaz.
 * Fark AMAÇTA: burada kalem değil TALEP oluşur — fiyat yoktur, karar ofistedir
 * (bkz. convertPartsRequestToOrderItemAction).
 */
export function PartsRequestSection({
  orderId,
  vehicle,
  requests,
  locked,
}: {
  orderId: string
  vehicle: PickerVehicle
  requests: TechnicianPartsRequest[]
  locked: boolean
}) {
  // "Bekliyor" = usta hâlâ parçayı bekliyor. Teslim alınmış VE ofisin iptal
  // ettiği talepler beklemez (iptal edilen parça hiç gelmeyecek).
  const pendingCount = requests.filter((r) => r.status !== "delivered" && r.status !== "cancelled").length

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Package className="size-4 text-muted-foreground" />
          Parça &amp; İşçilik Talepleri
        </h3>
        {requests.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {requests.length} talep{pendingCount > 0 && ` · ${pendingCount} bekliyor`}
          </span>
        )}
      </div>

      {locked ? (
        <p className="text-xs text-muted-foreground/70 mb-2">
          Teslim edilmiş/iptal edilmiş iş emrinde talep açılamaz
        </p>
      ) : (
        <PartsRequestComposer orderId={orderId} vehicle={vehicle} />
      )}

      <PartsRequestList requests={requests} locked={locked} />
    </div>
  )
}

// ── Talep kutusu ─────────────────────────────────────────────────────────────

/** Talebe konu parça: katalogdan, kendi stoğumuzdan ya da serbest metin. */
type Selection =
  | { kind: "catalog"; article: ArticleSearchResult }
  | { kind: "stock"; part: StockPartLite }
  | { kind: "manual"; name: string }

function selectionName(s: Selection): string {
  return s.kind === "catalog" ? s.article.productName : s.kind === "stock" ? s.part.name : s.name
}

/** Katalog parçası → detay modalı hedefi. */
function detailTarget(a: ArticleSearchResult, vehicle: PickerVehicle): PartDetailTarget {
  return {
    tecdocArticleId: a.tecdocArticleId,
    productName: a.productName,
    articleNo: a.articleNo,
    supplierName: a.supplierName,
    vehicleTypeId: vehicle.catalogVehicleTypeId,
  }
}

function PartsRequestComposer({ orderId, vehicle }: { orderId: string; vehicle: PickerVehicle }) {
  // Talep tipi. Varsayılan "part" — bugünkü akış hiç değişmeden açılır, dış
  // işçilik ikinci bir sekme gibi yanına gelir (BAK-105).
  const [requestType, setRequestType] = useState<PartsRequestTypeKey>("part")
  const [query, setQuery] = useState("")
  const [selection, setSelection] = useState<Selection | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState("")
  // Dış işçilik alanları: katalog yok, usta işin adını kendi yazar.
  const [laborName, setLaborName] = useState("")
  const [supplierName, setSupplierName] = useState("")
  const [estimatedPrice, setEstimatedPrice] = useState("")
  const [tecdocOpen, setTecdocOpen] = useState(false)
  // Detay modalı TEK örnek (Autocomplete popup'ı içinde Dialog render etmek
  // odak/portal çakışması yaratıyor — bkz. PartsLaborEditor). Açan taraf hedefi
  // ve "bu parçayı seç" eylemini birlikte verir.
  const [detail, setDetail] = useState<{ target: PartDetailTarget; onSelect: () => void } | null>(null)
  const [isPending, startTransition] = useTransition()

  const linked = vehicle.catalogVehicleTypeId != null

  // Araç katalog-bağlı ama parça cache'i boşsa arka planda doldur; dolarken
  // mevcut aramayı periyodik yeniden tetikle (iş emri composer'ıyla aynı desen).
  const [prefetching, setPrefetching] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const prefetchStartedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = undefined
    }
    setPrefetching(false)
  }, [])

  useEffect(() => {
    if (!linked || prefetchStartedRef.current) return
    prefetchStartedRef.current = true
    void ensureVehiclePartsPrefetched(vehicle.id)
      .then((res) => {
        if (res.status !== "started") return
        setPrefetching(true)
        let ticks = 0
        pollRef.current = setInterval(() => {
          ticks += 1
          setRefreshSignal((n) => n + 1)
          if (ticks >= 13) stopPolling() // 13 × 3sn ≈ 40sn üst sınır
        }, 3000)
      })
      .catch(() => {})
    return () => stopPolling()
  }, [linked, vehicle.id, stopPolling])

  const handleResultsCount = useCallback(
    (count: number) => {
      if (count > 0) stopPolling()
    },
    [stopPolling],
  )

  function pick(next: Selection) {
    setSelection(next)
    setQuery("")
  }

  function reset() {
    setSelection(null)
    setQuery("")
    setQuantity(1)
    setNote("")
    setLaborName("")
    setSupplierName("")
    setEstimatedPrice("")
  }

  // Tip değişince form sıfırlanır: parça seçimi dış işçilik talebine, işçilik
  // metni de parça talebine taşınmasın.
  function changeType(next: PartsRequestTypeKey) {
    if (next === requestType) return
    setRequestType(next)
    reset()
  }

  const isExternalLabor = requestType === "external_labor"
  const canSubmit = isExternalLabor ? laborName.trim().length > 0 : selection != null

  function submit() {
    if (!canSubmit || isPending) return
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("type", requestType)
    fd.set("note", note)

    if (isExternalLabor) {
      // Miktar GÖNDERİLMEZ: dış işçilik tek iştir, sunucu 1'e sabitler
      // (partsRequestSchema transform'u). Detay nota yazılır.
      fd.set("partName", laborName.trim())
      fd.set("supplierName", supplierName.trim())
      fd.set("estimatedPrice", estimatedPrice.trim())
    } else {
      if (!selection) return
      fd.set("partName", selectionName(selection))
      fd.set("quantity", String(quantity))
      if (selection.kind === "catalog") {
        fd.set("partSku", selection.article.articleNo ?? "")
        fd.set("brand", selection.article.supplierName ?? "")
        fd.set("tecdocArticleId", selection.article.tecdocArticleId != null ? String(selection.article.tecdocArticleId) : "")
      } else if (selection.kind === "stock") {
        fd.set("partSku", selection.part.sku || selection.part.oemNo || "")
        fd.set("brand", selection.part.brand ?? "")
      }
    }

    startTransition(async () => {
      const res = await createPartsRequestAction(fd)
      if (res && "error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success(isExternalLabor ? "Dış işçilik talebi gönderildi" : "Parça talebi gönderildi")
      reset()
    })
  }

  return (
    <div className="relative rounded-xl border border-border bg-gradient-to-b from-primary/[0.06] to-transparent p-3 pt-5 mb-3">
      <span className="absolute -top-2 left-4 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        {isExternalLabor ? "Yeni dış işçilik talebi" : "Yeni parça talebi"}
      </span>

      <ToggleGroup
        value={[requestType]}
        onValueChange={(v) => { if (v.length) changeType(v[0] as PartsRequestTypeKey) }}
        variant="outline"
        className="mb-3 w-full"
      >
        <ToggleGroupItem value="part" className="flex-1" disabled={isPending}>
          Parça
        </ToggleGroupItem>
        <ToggleGroupItem value="external_labor" className="flex-1" disabled={isPending}>
          Dış İşçilik
        </ToggleGroupItem>
      </ToggleGroup>

      {isExternalLabor ? (
        <ExternalLaborFields
          name={laborName}
          onNameChange={setLaborName}
          supplierName={supplierName}
          onSupplierNameChange={setSupplierName}
          estimatedPrice={estimatedPrice}
          onEstimatedPriceChange={setEstimatedPrice}
          note={note}
          onNoteChange={setNote}
          disabled={isPending}
        />
      ) : (
        <>
        {!linked && (
          // Katalogsuz araçta arama sınırlıdır; usta çıkmaza girmesin diye serbest
          // metinle talep edebileceği burada söylenir. VIN bağlama ofis işi olduğu
          // için teknisyen ekranına konmaz (bkz. VinLinkPrompt, iş emri sekmesi).
          <p className="mb-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Araç katalogla eşleşmediği için araca özel liste yok — parçayı adıyla yazıp talep edebilirsin.
          </p>
        )}

        {selection ? (
          <SelectedPart selection={selection} onClear={() => setSelection(null)} />
        ) : (
          <PartSearchInput
            value={query}
            sku={null}
            vehicleTypeId={vehicle.catalogVehicleTypeId}
            placeholder="Parça no, adı, marka veya OEM ara…"
            onNameChange={setQuery}
            onSelectArticle={(a) => pick({ kind: "catalog", article: a })}
            onSelectStockPart={(p) => pick({ kind: "stock", part: p })}
            onShowDetail={(a) =>
              setDetail({
                target: detailTarget(a, vehicle),
                onSelect: () => pick({ kind: "catalog", article: a }),
              })
            }
            onCommit={() => { if (query.trim()) pick({ kind: "manual", name: query.trim() }) }}
            onClear={() => setQuery("")}
            showClear={!!query}
            onSearchClick={linked ? () => setTecdocOpen(true) : undefined}
            searchDisabled={!linked}
            searchTitle={linked ? "TecDoc kataloğundan seç" : "Araç TecDoc'ta eşleşmedi"}
            showCreate
            createLabel="Talep et"
            onCreate={(text) => pick({ kind: "manual", name: text })}
            refreshSignal={refreshSignal}
            onResultsCount={handleResultsCount}
          />
        )}

        {prefetching && !selection && (
          <p className="flex items-center gap-1.5 px-1 pt-2 text-xs text-muted-foreground">
            <BrandSpinner size={14} className="!flex-row !gap-0" />
            Araca uygun parçalar hazırlanıyor…
          </p>
        )}

        {selection && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Miktar</span>
              <QuantityStepper value={quantity} onChange={setQuantity} disabled={isPending} />
            </div>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Not (opsiyonel) — ör. acil, sol ön"
            />
          </div>
        )}

        </>
      )}

      {(isExternalLabor || selection) && (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="lg"
            onClick={submit}
            disabled={isPending || !canSubmit}
            className="touch-manipulation"
          >
            {isPending ? <BrandSpinner size={16} className="!flex-row !gap-0" /> : <Send className="size-3.5" />}
            Talep Et
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={reset}
            disabled={isPending}
            className="touch-manipulation"
          >
            Vazgeç
          </Button>
        </div>
      )}

      {/* Tam TecDoc katalog picker (🔍) — yalnız araç kataloğa bağlıysa. */}
      {linked && (
        <TecdocPartPicker
          vehicle={vehicle}
          hideTrigger
          open={tecdocOpen}
          onOpenChange={setTecdocOpen}
          onSelect={(sel) => {
            pick({
              kind: "catalog",
              article: {
                tecdocArticleId: sel.tecdocArticleId,
                productName: sel.name,
                articleNo: sel.articleNo,
                supplierName: sel.supplierName,
                supplierId: null,
                imageUrl: null,
                categoryId: sel.categoryId,
                categoryName: sel.categoryName,
                matchedOems: [],
              },
            })
            setTecdocOpen(false)
          }}
          onShowDetail={(a) => {
            // Picker satırı kategori taşımaz (ArticleSummary); seçilirse kategori
            // boş kalır — talepte kategori zaten gösterilmiyor.
            const article: ArticleSearchResult = { ...a, categoryId: 0, categoryName: "", matchedOems: [] }
            setDetail({
              target: detailTarget(article, vehicle),
              onSelect: () => { pick({ kind: "catalog", article }); setTecdocOpen(false) },
            })
          }}
        />
      )}

      {/* Parça detayı — arama satırından ve picker'dan tek örnek olarak açılır. */}
      <PartDetailDialog
        target={detail?.target ?? null}
        onOpenChange={(open) => { if (!open) setDetail(null) }}
        onSelect={detail?.onSelect}
      />
    </div>
  )
}

/**
 * Dış işçilik talebinin alanları: katalog ARANMAZ (rot-balans yapan firma
 * TecDoc'ta yoktur), usta işi kendi adıyla yazar. Firma ve tahmini tutar
 * opsiyoneldir — usta sahada her zaman bilmez, ofis kaleme çevirirken tamamlar.
 */
function ExternalLaborFields({
  name,
  onNameChange,
  supplierName,
  onSupplierNameChange,
  estimatedPrice,
  onEstimatedPriceChange,
  note,
  onNoteChange,
  disabled,
}: {
  name: string
  onNameChange: (v: string) => void
  supplierName: string
  onSupplierNameChange: (v: string) => void
  estimatedPrice: string
  onEstimatedPriceChange: (v: string) => void
  note: string
  onNoteChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Araca dışarıda yaptırdığın işi yaz — rot-balans, şarj dinamosu, kaportacı gibi.
        Parça değil işçilik olduğu için stoktan düşülmez, fiyatı ofis girer.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="external-labor-name" className="text-xs text-muted-foreground">
          İşçilik <span className="text-destructive-strong">*</span>
        </Label>
        <Input
          id="external-labor-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          maxLength={200}
          placeholder="Ör. Rot balans ayarı"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="external-labor-supplier" className="text-xs text-muted-foreground">
            Nerede yaptırıldı
          </Label>
          <Input
            id="external-labor-supplier"
            type="text"
            value={supplierName}
            onChange={(e) => onSupplierNameChange(e.target.value)}
            disabled={disabled}
            maxLength={160}
            placeholder="Firma (opsiyonel)"
          />
        </div>
        <div className="space-y-1.5 sm:w-40">
          <Label htmlFor="external-labor-price" className="text-xs text-muted-foreground">
            Tahmini tutar
          </Label>
          <Input
            id="external-labor-price"
            type="text"
            // `inputMode="decimal"`: mobil klavyede virgül/nokta çıkar. type="number"
            // DEĞİL — Türkçe "1.250,50" biçimini tarayıcı geçersiz sayar ve alan
            // sessizce boşalır; metin olarak alıp parseTRYToKurus ile çeviriyoruz.
            inputMode="decimal"
            value={estimatedPrice}
            onChange={(e) => onEstimatedPriceChange(e.target.value)}
            disabled={disabled}
            maxLength={20}
            placeholder="₺ (opsiyonel)"
          />
        </div>
      </div>

      <Input
        type="text"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        disabled={disabled}
        placeholder="Not (opsiyonel) — ör. ön takım, fişi alındı"
      />
    </div>
  )
}

/** Seçilen parçanın kartı: talep gönderilmeden önce ne istendiği net görünsün. */
function SelectedPart({ selection, onClear }: { selection: Selection; onClear: () => void }) {
  const isCatalog = selection.kind === "catalog"
  const article = isCatalog ? selection.article : null
  const stock = selection.kind === "stock" ? selection.part : null

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
      {article?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className="size-12 shrink-0 rounded object-contain bg-white border border-border/60"
        />
      ) : (
        <span className="size-12 shrink-0 rounded bg-muted flex items-center justify-center">
          <PackageSearch className="size-5 text-muted-foreground/50" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground break-words">{selectionName(selection)}</p>
        <p className="text-xs text-muted-foreground break-words">
          {article && (
            <>
              <span className="font-mono">{article.articleNo}</span>
              {article.supplierName && <> · {article.supplierName}</>}
              {article.categoryName && <> · {article.categoryName}</>}
            </>
          )}
          {stock && (
            <>
              {stock.sku && <span className="font-mono">{stock.sku}</span>}
              {stock.brand && <>{stock.sku ? " · " : ""}{stock.brand}</>}
              <> · Stok: {stock.stockQty} {stock.unit}</>
            </>
          )}
          {selection.kind === "manual" && "Serbest talep — katalogda eşleşme seçilmedi"}
        </p>
        <p className="mt-1 text-[11px]">
          {isCatalog ? (
            <span className="inline-flex items-center gap-1 text-primary">
              <Info className="size-3" /> Bu araca uygun katalog parçası
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-warning-strong">
              <TriangleAlert className="size-3" />
              {stock ? "Kendi stok kartınız — araca bağlı değil" : "Katalog dışı — ofis parçayı doğrulayacak"}
            </span>
          )}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Seçimi temizle"
        onClick={onClear}
        className="shrink-0 touch-manipulation"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}

/** Eldivenli parmak için büyük miktar kontrolü. */
function QuantityStepper({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div className="inline-flex h-11 items-center rounded-lg border border-input bg-background">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-r-none touch-manipulation"
        aria-label="Azalt"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" />
      </Button>
      <span className="min-w-10 px-1 text-center text-sm font-medium tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 rounded-l-none touch-manipulation"
        aria-label="Arttır"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )
}

// ── Gönderilmiş talepler ─────────────────────────────────────────────────────

function PartsRequestList({ requests, locked }: { requests: TechnicianPartsRequest[]; locked: boolean }) {
  const [isPending, startTransition] = useTransition()

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/70">
        Henüz talep yok. İhtiyacın olan parçayı yukarıdan arayıp talep et; dışarıda yaptırdığın bir iş varsa
        &quot;Dış İşçilik&quot; sekmesinden gir — ofis karar verince burada görürsün.
      </p>
    )
  }

  // Teknisyenin ekranında anlamlı geçiş "teslim aldım"dır; "hazırlandı" ofisin
  // adımı olsa da parçayı kendi getiren usta da işaretleyebilsin diye durur.
  // `cancelled` bilerek yok: ofis talebi reddettiyse akış orada biter.
  const nextStatus: Record<string, { status: string; label: string }> = {
    requested: { status: "prepared", label: "Hazırlandı" },
    prepared: { status: "delivered", label: "Teslim Aldım" },
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const statusInfo = (PARTS_REQUEST_STATUS as Record<string, { label: string; color: string }>)[req.status]
        // Dış işçilikte fiziksel teslimat yok — "Hazırlandı/Teslim Aldım" akışı
        // yalnız parça için anlamlı, işçilik talebi ofis kararıyla kapanır.
        const next = req.type === "external_labor" ? undefined : nextStatus[req.status]
        const externalLabor = req.type === "external_labor"

        return (
          <PartCard
            key={req.id}
            name={req.partName}
            quantity={externalLabor ? undefined : req.quantity}
            partNo={req.partSku}
            brand={req.brand}
            note={
              req.note || req.status === "cancelled" ? (
                <>
                  {req.note && <span className="block break-words">{req.note}</span>}
                  {req.status === "cancelled" && (
                    <span className="mt-1 block break-words">
                      <span className="font-medium text-destructive-strong">Ofis iptal etti</span>
                      {req.cancelReason
                        ? `: ${req.cancelReason}`
                        : externalLabor
                          ? " — işçilik yaptırılmayacak"
                          : " — parça alınmayacak"}
                    </span>
                  )}
                </>
              ) : null
            }
            badge={
              <span className="inline-flex flex-wrap items-center justify-end gap-1">
                {externalLabor && (
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
                    Dış İşçilik
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                    statusInfo?.color
                  )}
                >
                  {statusInfo?.label || req.status}
                </span>
              </span>
            }
            meta={
              <>
                {new Date(req.createdAt).toLocaleDateString("tr-TR")}
                {req.tecdocArticleId != null && " · Katalog parçası"}
                {externalLabor && req.supplierName && ` · ${req.supplierName}`}
                {externalLabor && req.estimatedPriceKurus != null &&
                  ` · Tahmini ${formatKurus(req.estimatedPriceKurus)}`}
                {req.convertedAt && " · İş emrine kalem olarak eklendi"}
              </>
            }
            actions={
              !locked && next ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const res = await updatePartsRequestStatusAction(req.id, next.status)
                      if (res && "error" in res && res.error) toast.error(res.error)
                    })
                  }}
                  className="touch-manipulation"
                >
                  <CheckCircle2 className="size-3" />
                  {next.label}
                </Button>
              ) : null
            }
          />
        )
      })}
    </div>
  )
}
