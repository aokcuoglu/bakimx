"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Link2Off, Pencil, Plus, Send, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { SupplierAutocompleteField } from "@/components/suppliers/supplier-autocomplete-field"
import { PartSearchInput } from "@/components/parts/part-search-input"
import { PartNumberMatchAlert } from "@/components/parts/part-number-match-alert"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import { kurusToLira, parseTRYToKurus } from "@/lib/money"
import { partNameWithBrand } from "@/lib/ocr/part-box-result"
import type { PartBoxOcrResult, PartNumberSuggestion } from "@/lib/ocr/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
import { usePartNumberMatch } from "@/lib/parts/use-part-number-match"
import { purchaseMatchFields, type PurchaseMatch } from "@/lib/parts/purchase-match"
import { compressImageForUpload } from "@/lib/image/compress-image"
import { toast } from "sonner"

export type TechnicianInfo = { id: string; fullName: string; role: string }
export type SupplierInfo = { id: string; name: string }

/** Düzenlenebilir dış alım kaydı — teknisyen kartındaki "Düzenle" bunu doldurur. */
export type PurchaseFormItem = {
  id: string
  name: string
  sku: string | null
  brand: string | null
  quantity: number
  purchasePriceKurus: number | null
  supplierName: string | null
  purchasedAt: string | null
  tecdocArticleId: number | null
}

/** Katalog bağı: parça listeden seçildiğinde ya da numara eşleştirildiğinde dolar. */
type CatalogLink = {
  tecdocArticleId: number | null
  category: string
  categoryId: number | null
  /** Bağın nasıl kurulduğu — kullanıcıya gösterilen etiket. */
  label: string
}

function todayTrString(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, "0")
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${now.getFullYear()}`
}

/** ISO → dd.MM.yyyy (DatePicker depolama biçimi). */
function isoToTr(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}.${mm}.${d.getFullYear()}`
}

/**
 * "Parça Aldım" — yeni dış alım kaydı.
 */
export function AddPurchaseButton(props: {
  orderId: string
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  defaultTechnicianId: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="mt-2 px-0 text-sm font-medium text-primary hover:bg-transparent hover:underline"
      >
        <Plus className="size-4" />
        Parça Aldım
      </Button>
      {open && <PurchaseFormSheet {...props} open onOpenChange={setOpen} item={null} />}
    </>
  )
}

/**
 * Kart üzerindeki kalem simgesi — kayıtlı dış alımı düzenler (BAK-84).
 */
export function EditPurchaseButton(props: {
  orderId: string
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  item: PurchaseFormItem
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`${props.item.name} — dışarıdan alınan parçayı düzenle`}
        className="text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" />
      </Button>
      {open && (
        <PurchaseFormSheet
          {...props}
          defaultTechnicianId={null}
          open
          onOpenChange={setOpen}
        />
      )}
    </>
  )
}

/**
 * Dış alım formu — ekleme ve düzenleme için TEK yüzey (BAK-84).
 *
 * İki yeni davranış eskisine göre:
 *  1. Parça adı alanı artık serbest metin değil, "Yeni Parça Talebi" kutusuyla
 *     AYNI arama girdisi: araç şase bazlı TecDoc kataloğu + atölye stoğu. Listeden
 *     seçilen parça kalemi katalog bağıyla doldurur.
 *  2. Numara elle yazıldığında (ya da OCR çipinden geldiğinde) aynı numara üç
 *     kaynakta birden aranır ve BİREBİR eşleşme çıkarsa uyarı gösterilir. Uyarı
 *     ENGEL DEĞİLDİR: katalogda olmayan parça bugünkü gibi elle kaydedilir.
 *
 * Sunucu tarafı (`addPurchaseItemAction` / `updatePurchaseItemAction`) katalog
 * bağı olarak yalnız `tecdocArticleId` yazar — gerekçesi purchase-match.ts'te.
 */
export function PurchaseFormSheet({
  orderId,
  vehicle,
  suppliers,
  technicians,
  defaultTechnicianId,
  item,
  open,
  onOpenChange,
}: {
  orderId: string
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  defaultTechnicianId: string | null
  /** null → ekleme kipi; dolu → düzenleme kipi. */
  item: PurchaseFormItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const editing = item != null

  const [name, setName] = useState(item?.name ?? "")
  const [sku, setSku] = useState(item?.sku ?? "")
  const [brand, setBrand] = useState(item?.brand ?? "")
  const [link, setLink] = useState<CatalogLink | null>(
    item?.tecdocArticleId != null
      ? { tecdocArticleId: item.tecdocArticleId, category: "", categoryId: null, label: "Araç kataloğuna bağlı" }
      : null,
  )
  const [supplierName, setSupplierName] = useState(item?.supplierName ?? "")
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1))
  const [price, setPrice] = useState(
    item?.purchasePriceKurus != null ? String(kurusToLira(item.purchasePriceKurus)) : "",
  )
  const [purchasedAt, setPurchasedAt] = useState(editing ? isoToTr(item.purchasedAt) : todayTrString())
  const [technicianId, setTechnicianId] = useState(defaultTechnicianId || "")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<Pick<PartBoxOcrResult, "partName" | "brand" | "partNumbers"> | null>(null)
  const [ocrError, setOcrError] = useState<string | null>(null)
  // "Yok say" dedikten sonra aynı numara için uyarı bir daha açılmaz.
  const [dismissedNo, setDismissedNo] = useState<string | null>(null)

  const { matches, searching } = usePartNumberMatch({
    partNo: sku,
    vehicleTypeId: vehicle.catalogVehicleTypeId,
    // Bağ zaten kuruluysa ya da bu numara için "yok say" denmişse sorgu atılmaz.
    enabled: link == null && dismissedNo !== sku.trim(),
  })

  function applyMatch(match: PurchaseMatch) {
    const fields = purchaseMatchFields(match)
    setName(fields.name)
    setSku(fields.sku)
    setBrand(fields.brand)
    setLink({
      tecdocArticleId: fields.tecdocArticleId,
      category: fields.category,
      categoryId: fields.categoryId,
      label:
        match.kind === "catalog"
          ? "Araç kataloğuyla eşleştirildi"
          : match.kind === "bakimx"
            ? "BakımX kataloğundan dolduruldu"
            : "Stok kartınızdan dolduruldu",
    })
  }

  function clearLink() {
    setLink(null)
    setDismissedNo(sku.trim())
  }

  async function onPickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setOcrResult(null)
    setOcrError(null)
    if (!f) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    const prepared = await compressImageForUpload(f)
    if (!prepared.ok) {
      toast.error(prepared.error)
      setFile(null)
      setPreviewUrl(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }
    setFile(prepared.file)
    setPreviewUrl(URL.createObjectURL(prepared.file))
    void runPartBoxOcr(prepared.file)
  }

  async function runPartBoxOcr(f: File) {
    setOcrLoading(true)
    setOcrError(null)
    try {
      const fd = new FormData()
      fd.set("image", f)
      const res = await fetch("/api/parts/ocr", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setOcrError(data?.error || "Kutu okunamadı, alanları elle girebilirsiniz.")
        return
      }
      setOcrResult({
        partName: data.result.partName,
        brand: data.result.brand,
        partNumbers: data.result.partNumbers ?? [],
      })
    } catch {
      setOcrError("Kutu okunamadı, alanları elle girebilirsiniz.")
    } finally {
      setOcrLoading(false)
    }
  }

  /** Numara elle değişince katalog bağı geçersizleşir — yanlış parçaya bağlı kalmasın. */
  function onSkuChange(next: string) {
    setSku(next)
    if (link) setLink(null)
    setDismissedNo(null)
  }

  function close() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    onOpenChange(false)
  }

  async function handleSubmit() {
    setError(null)
    if (!name.trim()) {
      setError("Parça adı zorunludur")
      return
    }
    const priceKurus = price.trim() ? parseTRYToKurus(price) : 0
    if (priceKurus == null) {
      setError("Geçerli bir alış fiyatı giriniz")
      return
    }

    const fd = new FormData()
    fd.set("name", name.trim())
    fd.set("sku", sku.trim())
    fd.set("brand", brand.trim())
    fd.set("quantity", quantity || "1")
    fd.set("purchasePriceKurus", String(priceKurus))
    fd.set("purchasedAt", purchasedAt)
    // Boş string alanı temizler (şemada nullable) — eşleşme kaldırılınca bağ düşer.
    fd.set("tecdocArticleId", link?.tecdocArticleId != null ? String(link.tecdocArticleId) : "")
    // Kategori YALNIZ bağ varken yazılır: alan gönderilmeyince sunucu ona hiç
    // dokunmaz (kısmi güncelleme). Bağsız düzenlemede boş göndermek, masadan
    // elle girilmiş bir kategoriyi sessizce silerdi.
    if (link) {
      fd.set("category", link.category)
      fd.set("categoryId", link.categoryId != null ? String(link.categoryId) : "")
    }

    const url = editing
      ? `/api/orders/purchases?id=${item.id}&orderId=${orderId}`
      : "/api/orders/purchases"
    if (!editing) {
      fd.set("serviceOrderId", orderId)
      fd.set("supplierName", supplierName.trim())
      if (supplierId) fd.set("supplierId", supplierId)
      if (technicianId) fd.set("purchasedById", technicianId)
      if (file) fd.set("file", file)
    } else if (supplierId || supplierName.trim() !== (item.supplierName ?? "")) {
      // Tedarikçi alanı ancak GERÇEKTEN değiştiyse gönderilir. Aksi halde
      // dokunulmamış bir formda kayıtlı `supplierId` bağı düşerdi (formda
      // taşınmıyor). Ad elle değiştirilip listeden seçim yapılmadıysa eski bağ
      // bilerek temizlenir — görünen ad ile kayıtlı tedarikçi çelişmesin
      // (masa tarafındaki satın alma detayıyla aynı kural).
      fd.set("supplierName", supplierName.trim())
      fd.set("supplierId", supplierId || "")
    }

    setSubmitting(true)
    try {
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Kaydedilemedi")
        setSubmitting(false)
        return
      }
      close()
      router.refresh()
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Dış Alım Kaydını Düzenle" : "Dışarıdan Parça Alımı"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Parça bilgilerini güncelleyin; kalem iş emrinde aynı anda değişir."
              : "Aldığınız parçayı bu iş emrine kalem olarak ekleyin."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {error && (
            <p className="text-sm text-destructive-strong bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Parça adı *</label>
            {/* "Yeni Parça Talebi" ile AYNI arama: araca uygun katalog + atölye stoğu.
                Katalogda olmayan parça yazılmaya devam edilebilir (serbest metin). */}
            <PartSearchInput
              value={name}
              sku={null}
              vehicleTypeId={vehicle.catalogVehicleTypeId}
              placeholder="Parça no, adı, marka veya OEM ara…"
              onNameChange={(v) => {
                setName(v)
                if (link) setLink(null)
              }}
              onSelectArticle={(a) => {
                setName(a.productName)
                setSku(a.articleNo)
                setBrand(a.supplierName || "")
                setDismissedNo(null)
                setLink({
                  tecdocArticleId: a.tecdocArticleId,
                  category: a.categoryName || "",
                  categoryId: a.categoryId || null,
                  label: "Araç kataloğundan seçildi",
                })
              }}
              onSelectStockPart={(p) => {
                setName(p.name)
                setSku(p.sku || p.oemNo || "")
                setBrand(p.brand || "")
                setDismissedNo(null)
                // Stok kartına KİMLİK bağı kurulmaz: partId stok düşümü tetiklerdi,
                // oysa parça dışarıdan alındı (bkz. purchase-match.ts).
                setLink({
                  tecdocArticleId: null,
                  category: "",
                  categoryId: null,
                  label: "Stok kartınızdan dolduruldu",
                })
              }}
              onClear={() => {
                setName("")
                setLink(null)
              }}
              showClear={!!name}
            />
          </div>

          {link && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
              <span className="text-xs font-medium text-primary">{link.label}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearLink}
                className="-my-1 h-8 text-xs text-muted-foreground"
              >
                <Link2Off className="size-3.5" />
                Bağı kaldır
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Parça no / OEM</label>
              <Input value={sku} onChange={(e) => onSkuChange(e.target.value)} placeholder="SKU / OEM" />
            </div>
            <div className="w-24 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Miktar</label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>

          {link == null && dismissedNo !== sku.trim() && (
            <PartNumberMatchAlert
              matches={matches}
              searching={searching}
              onApply={applyMatch}
              onDismiss={() => setDismissedNo(sku.trim())}
            />
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Marka</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Örn. BOSCH" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tedarikçi</label>
            <SupplierAutocompleteField
              suppliers={suppliers}
              value={supplierName}
              onChange={setSupplierName}
              onSelectSupplier={setSupplierId}
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Alış fiyatı (₺)</label>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Alış tarihi</label>
              <DatePicker value={purchasedAt} onChange={setPurchasedAt} />
            </div>
          </div>

          {!editing && technicians.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Alan teknisyen</label>
              <Select value={technicianId} onValueChange={(v) => setTechnicianId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Parça kutusu fotoğrafı + OCR yalnız EKLEME kipinde: kutu alım anında
              çekilir, düzenleme kaydı sonradan açar. Fotoğrafın kendisi masa
              tarafındaki satın alma detayından değiştirilir. */}
          {!editing && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Parça kutusu fotoğrafı</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                />
                {previewUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Parça kutusu" className="w-full max-h-48 object-contain rounded-lg border border-border bg-muted" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 touch-manipulation"
                      onClick={() => onPickFile(null)}
                    >
                      <Trash2 className="size-3.5" />
                      Kaldır
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-auto w-full flex-col items-center justify-center gap-1.5 border-dashed bg-muted/40 py-6 text-sm font-normal text-muted-foreground touch-manipulation"
                  >
                    <Camera className="size-6" />
                    Fotoğraf çek / seç
                  </Button>
                )}
              </div>

              {ocrLoading && (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 py-6">
                  <BrandSpinner size={36} label="Kutu okunuyor…" />
                </div>
              )}

              {ocrError && !ocrLoading && (
                <p className="text-xs text-muted-foreground bg-muted/50 border border-border rounded-lg px-3 py-2">
                  {ocrError}
                </p>
              )}

              {ocrResult && !ocrLoading && (
                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs font-medium text-primary">Kutudan okunan öneriler</p>

                  {ocrResult.partName.value && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Parça adı</span>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setName(ocrResult.partName.value)}
                          className="rounded-full text-xs font-normal touch-manipulation"
                        >
                          {ocrResult.partName.value}
                        </Button>
                        {ocrResult.brand.value && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setName(partNameWithBrand(ocrResult.partName.value, ocrResult.brand.value))
                              setBrand(ocrResult.brand.value)
                            }}
                            className="rounded-full text-xs font-normal touch-manipulation"
                          >
                            {partNameWithBrand(ocrResult.partName.value, ocrResult.brand.value)}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {ocrResult.partNumbers.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">Parça no (birini seçin)</span>
                      <div className="flex flex-wrap gap-1.5">
                        {ocrResult.partNumbers.map((pn: PartNumberSuggestion) => {
                          const low = pn.confidence != null && pn.confidence < LOW_CONFIDENCE_THRESHOLD
                          return (
                            <Button
                              key={pn.value}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => onSkuChange(pn.value)}
                              title={low ? "Düşük okuma güveni — kontrol edin" : undefined}
                              className={
                                "rounded-full text-xs font-normal touch-manipulation " +
                                (low ? "border-warning/40 bg-warning/10 text-warning-strong" : "")
                              }
                            >
                              <span className="text-muted-foreground">{pn.label}</span>
                              <span className="text-border">·</span>
                              {pn.value}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              className="flex-1 touch-manipulation"
              disabled={submitting || !name.trim()}
              onClick={handleSubmit}
            >
              <Send className="size-3.5" />
              {submitting ? "Kaydediliyor…" : editing ? "Kaydet" : "Kalem Olarak Ekle"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="touch-manipulation"
              disabled={submitting}
              onClick={close}
            >
              İptal
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
