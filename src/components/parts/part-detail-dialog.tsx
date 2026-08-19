"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { PhotoLightbox } from "@/components/shared/photo-lightbox"
import { CheckCircle2, HelpCircle, PackageSearch, Plus, ZoomIn } from "lucide-react"
import type { ArticleCompatibility, ArticleCrossRef, ArticleDetailPublic } from "@/lib/tecdoc/types"

/** Modalı açan taraf bu kadarını zaten biliyor — veri gelene kadar başlık dolu görünür. */
export type PartDetailTarget = {
  tecdocArticleId: number
  productName: string
  articleNo: string
  supplierName: string
  /** Aracın katalog kimliği (catalogVehicleTypeId) — yoksa uygunluk bölümü gizlenir. */
  vehicleTypeId: number | null
  /** Araç etiketi ("HONDA CIVIC · 34 ABC 123") — uygunluk açıklamasında geçer. */
  vehicleLabel?: string
}

const EMPTY_STATE = {
  detail: null,
  compatibility: null,
  loading: false,
  error: "",
  crossRefs: null,
  crossRefsLoading: false,
  crossRefsError: "",
} as const

/** ISO tarihten yıl-ay ("2016-09-01" → "09/2016"); çözülemezse ham değer. */
function formatInterval(start: string | null, end: string | null): string | null {
  const fmt = (v: string | null) => {
    if (!v) return null
    const m = /^(\d{4})-(\d{2})/.exec(v)
    return m ? `${m[2]}/${m[1]}` : v
  }
  const s = fmt(start)
  const e = fmt(end)
  if (!s && !e) return null
  return `${s ?? "?"} – ${e ?? "devam ediyor"}`
}

/**
 * Parça Detayı — teknik özellikler, OEM numaraları, muadiller ve araca uygunluk.
 *
 * Tek örnek olarak üst bileşende (parts-labor-grid) tutulur; arama dropdown'ı,
 * katalog picker'ı ve eklenmiş kalem satırı yalnız `target` set eder. Sebep:
 * Autocomplete popup'ının içinde Dialog render etmek odak/portal çakışması
 * yaratıyor.
 *
 * Veri /api/tecdoc/articles/[articleId] üzerinden gelir; sağlayıcı yanıtı kalıcı
 * cache'lidir, aynı parça ikinci açılışta faturalanmaz. Muadiller ayrı ve TEMBEL
 * (bölüm açılmadan çağrılmaz).
 */
export function PartDetailDialog({
  target,
  onOpenChange,
  onSelect,
}: {
  /** null → modal kapalı. */
  target: PartDetailTarget | null
  onOpenChange: (open: boolean) => void
  /**
   * Verilirse "Bu parçayı seç" butonu görünür. Ne yaptığı bağlama göre değişir:
   * composer'da kalemi ekler, mevcut satırda satırı doldurur. Eklenmiş kalemin
   * ⓘ'sinden açıldığında geçilmez → buton hiç çıkmaz.
   */
  onSelect?: () => void
}) {
  // Tek nesne: parça değişince hepsi ATOMİK sıfırlanmalı (yoksa yeni parçanın
  // yükleme ekranında eski parçanın ölçüleri/muadilleri görünürdü).
  const [state, setState] = useState<{
    detail: ArticleDetailPublic | null
    compatibility: ArticleCompatibility | null
    loading: boolean
    error: string
    crossRefs: ArticleCrossRef[] | null
    crossRefsLoading: boolean
    crossRefsError: string
  }>(EMPTY_STATE)
  const { detail, compatibility, loading, error, crossRefs, crossRefsLoading, crossRefsError } = state

  const [lightboxOpen, setLightboxOpen] = useState(false)

  const articleId = target?.tecdocArticleId ?? null
  const vehicleTypeId = target?.vehicleTypeId ?? null

  useEffect(() => {
    if (articleId == null) return
    let active = true
    // Parça değişimi yükleme durumuna geçişi zorunlu kılar; eski parçanın
    // detayı bir kare bile görünmemeli.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ ...EMPTY_STATE, loading: true })
    ;(async () => {
      try {
        const qs = vehicleTypeId != null ? `?vehicleId=${vehicleTypeId}` : ""
        const res = await fetch(`/api/tecdoc/articles/${articleId}${qs}`)
        const data = await res.json()
        if (!active) return
        if (!res.ok) {
          setState((s) => ({ ...s, loading: false, error: data.error || "Parça detayı alınamadı." }))
        } else {
          setState((s) => ({ ...s, loading: false, detail: data.detail, compatibility: data.compatibility ?? null }))
        }
      } catch {
        if (active) {
          setState((s) => ({
            ...s,
            loading: false,
            error: "Parça detayı alınamadı. Bağlantınızı kontrol edip tekrar deneyin.",
          }))
        }
      }
    })()
    return () => {
      active = false
    }
  }, [articleId, vehicleTypeId])

  /** Muadiller yalnız bölüm ilk kez açılınca çekilir (ayrı faturalı çağrı). */
  async function loadCrossRefs() {
    if (articleId == null || crossRefs != null || crossRefsLoading) return
    setState((s) => ({ ...s, crossRefsLoading: true, crossRefsError: "" }))
    try {
      const res = await fetch(`/api/tecdoc/articles/${articleId}/cross-refs`)
      const data = await res.json()
      setState((s) => ({
        ...s,
        crossRefsLoading: false,
        ...(res.ok
          ? { crossRefs: data.crossRefs ?? [] }
          : { crossRefsError: data.error || "Muadil listesi alınamadı." }),
      }))
    } catch {
      setState((s) => ({ ...s, crossRefsLoading: false, crossRefsError: "Muadil listesi alınamadı." }))
    }
  }

  const open = target != null
  const imageUrl = detail?.imageUrl ?? null
  const interval = compatibility?.fitment
    ? formatInterval(compatibility.fitment.constructionIntervalStart, compatibility.fitment.constructionIntervalEnd)
    : null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b p-4 text-left">
            <DialogTitle className="text-base">{target?.productName ?? "Parça detayı"}</DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {target?.articleNo && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {target.articleNo}
                </span>
              )}
              {target?.supplierName && <span>{target.supplierName}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {loading && (
              <div className="flex justify-center py-10">
                <BrandSpinner size={40} label="Parça bilgileri getiriliyor…" />
              </div>
            )}

            {!loading && error && <p className="py-6 text-center text-sm text-destructive-strong">{error}</p>}

            {!loading && !error && detail && (
              <div className="space-y-5">
                {/* --- Uygunluk: en üstte, çünkü ustanın ilk sorusu bu --- */}
                {vehicleTypeId != null && compatibility && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    {compatibility.status === "linked" ? (
                      <>
                        <Badge className="gap-1">
                          <CheckCircle2 />
                          Bu araca uygun
                        </Badge>
                        {compatibility.fitment ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            TecDoc kataloğunda{" "}
                            <span className="font-medium text-foreground">
                              {compatibility.fitment.manufacturerName} {compatibility.fitment.modelName}
                              {compatibility.fitment.typeEngineName ? ` · ${compatibility.fitment.typeEngineName}` : ""}
                            </span>{" "}
                            için listeleniyor{interval ? ` (üretim ${interval})` : ""}.
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Bu parça {target?.vehicleLabel ? `${target.vehicleLabel} ` : "aracın "}katalogunda
                            listeleniyor.
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="gap-1">
                          <HelpCircle />
                          Uygunluk doğrulanamadı
                        </Badge>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Bu parça aracın katalog listesinde bulunamadı — uymadığı anlamına gelmez. Takmadan önce
                          aşağıdaki ölçüleri sökülen parçayla karşılaştırın.
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* --- Görsel --- */}
                <div className="flex justify-center">
                  {imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="group relative rounded-lg border bg-card p-2"
                      aria-label="Görseli büyüt"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl}
                        alt={detail.productName}
                        className="h-44 w-full max-w-xs object-contain sm:h-52"
                      />
                      <span className="absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-full bg-foreground/70 text-background opacity-80 transition-opacity group-hover:opacity-100">
                        <ZoomIn className="size-4" />
                      </span>
                    </button>
                  ) : (
                    <div className="flex h-44 w-full max-w-xs items-center justify-center rounded-lg border bg-muted">
                      <PackageSearch className="size-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* --- Teknik özellikler --- */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Teknik özellikler</h3>
                  {detail.specs.length > 0 ? (
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 md:grid-cols-2">
                      {detail.specs.map((s) => (
                        <div key={s.name} className="flex items-baseline justify-between gap-3 border-b border-dashed py-1">
                          <dt className="text-xs text-muted-foreground">{s.name}</dt>
                          <dd className="text-right text-sm font-medium">{s.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-xs text-muted-foreground">Bu parça için teknik özellik bilgisi yok.</p>
                  )}
                </section>

                {/* --- OEM numaraları --- */}
                {detail.oems.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold">OEM numaraları</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.oems.map((o) => (
                        <span
                          key={`${o.brand}-${o.number}`}
                          className="rounded border bg-muted/50 px-1.5 py-0.5 text-[11px]"
                          title={o.brand}
                        >
                          <span className="text-muted-foreground">{o.brand}</span>{" "}
                          <span className="font-mono">{o.number}</span>
                        </span>
                      ))}
                    </div>
                    {detail.eanNumbers.length > 0 && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        EAN: <span className="font-mono">{detail.eanNumbers.join(", ")}</span>
                      </p>
                    )}
                  </section>
                )}

                {/* --- Muadiller (tembel) --- */}
                {/* defaultValue=[] ŞART: Base UI akordeonu varsayılanda ilk öğeyi
                    AÇIK render ediyor — muadil çağrısı kullanıcı istemeden
                    tetikleniyor ve boşuna faturalanıyordu (QA'de yakalandı).
                    onValueChange kapanışta da tetiklendiği için açık-mı diye bakılır. */}
                <Accordion
                  className="border-t"
                  defaultValue={[]}
                  onValueChange={(value) => {
                    if (Array.isArray(value) ? value.length > 0 : value != null) void loadCrossRefs()
                  }}
                >
                  <AccordionItem value="cross-refs" className="border-b-0">
                    <AccordionTrigger>Muadil parçalar</AccordionTrigger>
                    <AccordionContent>
                      {crossRefsLoading && (
                        <div className="flex justify-center py-4">
                          <BrandSpinner size={32} label="Muadiller getiriliyor…" />
                        </div>
                      )}
                      {crossRefsError && <p className="py-2 text-xs text-destructive-strong">{crossRefsError}</p>}
                      {!crossRefsLoading && !crossRefsError && crossRefs && (
                        <>
                          {crossRefs.length === 0 ? (
                            <p className="py-2 text-xs text-muted-foreground">Muadil parça bulunamadı.</p>
                          ) : (
                            <ul className="divide-y">
                              {crossRefs.map((r) => (
                                <li
                                  key={`${r.supplierName}-${r.articleNo}`}
                                  className="flex items-center justify-between gap-3 py-1.5"
                                >
                                  <span className="min-w-0 truncate text-xs text-muted-foreground">
                                    {r.supplierName}
                                  </span>
                                  <span className="shrink-0 font-mono text-xs">{r.articleNo}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </div>

          {onSelect && (
            <div className="border-t p-3">
              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={() => {
                  onSelect()
                  onOpenChange(false)
                }}
              >
                <Plus />
                Bu parçayı seç
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox portal'ı body'ye çıkar ve z-[100] ile Dialog'un (z-50) üstünde kalır. */}
      {imageUrl && (
        <PhotoLightbox
          photos={[
            {
              id: `article-${articleId}`,
              label: detail?.productName,
              note: detail?.articleNo ?? null,
              fileUrl: imageUrl,
            },
          ]}
          index={0}
          onIndexChange={() => {}}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      )}
    </>
  )
}
