"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  CheckCircle2, Info, Loader2, Minus, Package, PackageSearch, Plus, Send,
  TriangleAlert, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { PARTS_REQUEST_STATUS } from "@/lib/constants"
import { PartSearchInput } from "@/components/parts/part-search-input"
import { PartDetailDialog, type PartDetailTarget } from "@/components/parts/part-detail-dialog"
import { TecdocPartPicker, type PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import { ensureVehiclePartsPrefetched } from "@/app/(app)/parts/actions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { StockPartLite } from "@/lib/parts/suggestions"
import { createPartsRequestAction, updatePartsRequestStatusAction } from "@/app/(app)/technician/actions"

export type TechnicianPartsRequest = {
  id: string
  partName: string
  partSku: string | null
  brand: string | null
  tecdocArticleId: number | null
  quantity: number
  note: string | null
  status: string
  convertedAt: string | null
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
  const pendingCount = requests.filter((r) => r.status !== "delivered").length

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Package className="size-4 text-muted-foreground" />
          Parça Talepleri
        </h3>
        {requests.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {requests.length} talep{pendingCount > 0 && ` · ${pendingCount} bekliyor`}
          </span>
        )}
      </div>

      {locked ? (
        <p className="text-xs text-muted-foreground/70 mb-2">
          Teslim edilmiş/iptal edilmiş iş emrinde parça talep edilemez
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
  const [query, setQuery] = useState("")
  const [selection, setSelection] = useState<Selection | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState("")
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
  }

  function submit() {
    if (!selection || isPending) return
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("partName", selectionName(selection))
    fd.set("quantity", String(quantity))
    fd.set("note", note)
    if (selection.kind === "catalog") {
      fd.set("partSku", selection.article.articleNo ?? "")
      fd.set("brand", selection.article.supplierName ?? "")
      fd.set("tecdocArticleId", selection.article.tecdocArticleId != null ? String(selection.article.tecdocArticleId) : "")
    } else if (selection.kind === "stock") {
      fd.set("partSku", selection.part.sku || selection.part.oemNo || "")
      fd.set("brand", selection.part.brand ?? "")
    }
    startTransition(async () => {
      const res = await createPartsRequestAction(fd)
      if (res && "error" in res && res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Parça talebi gönderildi")
      reset()
    })
  }

  return (
    <div className="relative rounded-xl border border-border bg-gradient-to-b from-primary/[0.06] to-transparent p-3 pt-5 mb-3">
      <span className="absolute -top-2 left-4 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        Yeni parça talebi
      </span>

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
          placeholder="Parça no, adı veya marka ara…"
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
          <Loader2 className="h-3 w-3 animate-spin" />
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
          <div className="flex gap-2">
            <Button type="button" size="lg" onClick={submit} disabled={isPending} className="touch-manipulation">
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
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
              },
            })
            setTecdocOpen(false)
          }}
          onShowDetail={(a) => {
            // Picker satırı kategori taşımaz (ArticleSummary); seçilirse kategori
            // boş kalır — talepte kategori zaten gösterilmiyor.
            const article: ArticleSearchResult = { ...a, categoryId: 0, categoryName: "" }
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
        Henüz parça talebi yok. İhtiyacın olan parçayı yukarıdan arayıp talep et — ofis hazırlayınca burada görürsün.
      </p>
    )
  }

  // Teknisyenin ekranında anlamlı geçiş "teslim aldım"dır; "hazırlandı" ofisin
  // adımı olsa da parçayı kendi getiren usta da işaretleyebilsin diye durur.
  const nextStatus: Record<string, { status: string; label: string }> = {
    requested: { status: "prepared", label: "Hazırlandı" },
    prepared: { status: "delivered", label: "Teslim Aldım" },
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const statusInfo = (PARTS_REQUEST_STATUS as Record<string, { label: string; color: string }>)[req.status]
        const next = nextStatus[req.status]

        return (
          <div key={req.id} className="rounded-lg bg-muted px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground break-words">
                  {req.partName}
                  <span className="ml-1.5 text-xs text-muted-foreground">×{req.quantity}</span>
                </p>
                <p className="text-xs text-muted-foreground break-words">
                  {req.partSku && <span className="font-mono">{req.partSku}</span>}
                  {req.brand && <>{req.partSku ? " · " : ""}{req.brand}</>}
                </p>
                {req.note && <p className="text-xs text-muted-foreground mt-0.5 break-words">{req.note}</p>}
              </div>
              <span
                className={cn(
                  "shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border",
                  statusInfo?.color
                )}
              >
                {statusInfo?.label || req.status}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground/70">
                {new Date(req.createdAt).toLocaleDateString("tr-TR")}
                {req.tecdocArticleId != null && " · Katalog parçası"}
                {req.convertedAt && " · İş emrine kalem olarak eklendi"}
              </span>
              {!locked && next && (
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
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
