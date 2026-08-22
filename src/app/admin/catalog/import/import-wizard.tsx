"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardPagination, useDashboardPage } from "@/components/dashboard/dashboard-pagination"
import { formatKurus } from "@/lib/money"
import {
  CATALOG_IMPORT_COLUMNS,
  CATALOG_IMPORT_MODE_LABELS,
  IMPORT_MAX_ROWS,
  requiredImportFields,
  type CatalogImportMode,
} from "@/lib/catalog/product-import"
import type { CatalogBrandOption } from "@/app/admin/catalog/data"
import type { CatalogImportHistoryRow } from "@/app/admin/catalog/import/data"
import { cancelBakimxCatalogImportAction } from "@/app/admin/catalog/import/actions"
import type { ImportActionError, ImportApplyResult, ImportPreviewResult, ImportPreviewRow } from "@/lib/catalog/bakimx-import-service"

/**
 * İçe aktarma sihirbazı: **dosya seç → ön izle → uygula.**
 *
 * Dosya `File` nesnesi olarak bu bileşende tutulur ve uygulama adımında AYNI
 * dosya ikinci kez gönderilir; sunucu SHA-256 ile ön izlemedeki dosya olduğunu
 * doğrular (bkz. bakimx-import-service.ts). Böylece tarayıcı hafızasında 20.000 satırlık bir
 * planı taşımaya ya da sunucuda oturum durumu tutmaya gerek kalmaz.
 */

/**
 * Yükleme uçları route handler (server action gövde sınırı 1 MB — bkz.
 * bakimx-import-service.ts). 404 yetki reddidir: admin konsolunun varlığı ele
 * verilmesin diye sunucu `notFound()` fırlatıyor.
 */
async function postImport<T extends { ok: true }>(endpoint: "preview" | "apply", body: FormData): Promise<T | ImportActionError> {
  try {
    const response = await fetch(`/api/admin/catalog/import/${endpoint}`, {
      method: "POST",
      body,
    })
    if (response.status === 404) return { ok: false, error: "Bu işlem için yetkiniz yok." }
    const payload = (await response.json()) as T | ImportActionError
    if (!response.ok && !("error" in payload)) return { ok: false, error: "İşlem tamamlanamadı." }
    return payload
  } catch {
    return {
      ok: false,
      error: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.",
    }
  }
}

const STATUS_LABELS: Record<CatalogImportHistoryRow["status"], string> = {
  pending: "Yükleniyor",
  previewed: "Ön izlendi",
  applied: "Uygulandı",
  failed: "Başarısız",
  cancelled: "İptal edildi",
}

const STATUS_VARIANTS: Record<CatalogImportHistoryRow["status"], "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  previewed: "secondary",
  applied: "default",
  failed: "destructive",
  cancelled: "outline",
}

const PREVIEW_PAGE_SIZE = 25

export function CatalogImportWizard({ brands, history }: { brands: CatalogBrandOption[]; history: CatalogImportHistoryRow[] }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [brandId, setBrandId] = useState(brands[0]?.id ?? "")
  const [mode, setMode] = useState<CatalogImportMode>("upsert")
  const [pricesIncludeVat, setPricesIncludeVat] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [applied, setApplied] = useState<ImportPreviewResult | null>(null)
  const [error, setError] = useState<{
    message: string
    details: string[]
  } | null>(null)
  const [pending, startTransition] = useTransition()

  const brandName = brands.find((b) => b.id === brandId)?.name ?? ""

  function buildFormData(): FormData {
    const data = new FormData()
    data.set("file", file as File)
    data.set("brandId", brandId)
    data.set("mode", mode)
    data.set("pricesIncludeVat", String(pricesIncludeVat))
    return data
  }

  /** Ayar değişince eski ön izleme geçersizdir — yanlış rapora "Uygula" bastırmayalım. */
  function resetPreview() {
    setPreview(null)
    setApplied(null)
    setError(null)
  }

  function onPickFile(next: File | null) {
    setFile(next)
    resetPreview()
  }

  function runPreview() {
    if (!file || !brandId) return
    setError(null)
    startTransition(async () => {
      const result = await postImport<ImportPreviewResult>("preview", buildFormData())
      if (!result.ok) {
        setPreview(null)
        setError({ message: result.error, details: result.details ?? [] })
        return
      }
      setPreview(result)
      router.refresh()
    })
  }

  function runApply() {
    if (!file || !preview) return
    setError(null)
    startTransition(async () => {
      const body = buildFormData()
      body.set("importId", preview.importId)
      const result = await postImport<ImportApplyResult>("apply", body)
      if (!result.ok) {
        setError({ message: result.error, details: result.details ?? [] })
        return
      }
      setApplied({ ...preview, counts: result.counts })
      setPreview(null)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      toast.success(`${result.counts.created} yeni, ${result.counts.updated} güncellenmiş ürün.`)
      router.refresh()
    })
  }

  function runCancel() {
    if (!preview) return
    const importId = preview.importId
    startTransition(async () => {
      const result = await cancelBakimxCatalogImportAction(importId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      resetPreview()
      router.refresh()
    })
  }

  const requiredLabels = requiredImportFields(mode)
    .map((field) => CATALOG_IMPORT_COLUMNS.find((c) => c.field === field)?.label ?? field)
    .join(", ")

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link href="/admin/catalog">
                <ArrowLeft className="size-3.5" />
              </Link>
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ürün İçe Aktarma</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Marka seçip CSV veya JSON yükleyin. Değişiklikler <strong>siz onaylamadan</strong> uygulanmaz.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <a href="/admin/catalog/import/template" download>
            <Download className="size-3.5 mr-1" /> Şablon indir
          </a>
        </Button>
      </div>

      {applied && <AppliedSummary result={applied} />}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              ["1", "Dosyayı seçin"],
              ["2", "Sonuçları inceleyin"],
              ["3", "Değişiklikleri uygulayın"],
            ].map(([step, label]) => (
              <div key={step} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {step}
                </span>
                <span className="font-medium text-foreground">{label}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="import-brand">
                Marka
              </label>
              <Select
                value={brandId}
                onValueChange={(v) => {
                  setBrandId(v)
                  resetPreview()
                }}
              >
                <SelectTrigger id="import-brand" className="w-full">
                  <SelectValue placeholder="Marka seçin" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                      {!brand.isActive && " (pasif)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="import-mode">
                İçe aktarma modu
              </label>
              <Select
                value={mode}
                onValueChange={(v) => {
                  setMode(v as CatalogImportMode)
                  resetPreview()
                }}
              >
                <SelectTrigger id="import-mode" className="w-full">
                  <SelectValue placeholder="Mod seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATALOG_IMPORT_MODE_LABELS) as CatalogImportMode[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {CATALOG_IMPORT_MODE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium text-foreground">Fiyatlar KDV dahil</p>
              <p className="text-xs text-muted-foreground">
                Katalog fiyatı KDV hariç saklanır; işaretlerseniz değerler yüklenirken hariçe çevrilir.
              </p>
            </div>
            <Switch
              checked={pricesIncludeVat}
              onCheckedChange={(v) => {
                setPricesIncludeVat(Boolean(v))
                resetPreview()
              }}
              aria-label="Fiyatlar KDV dahil"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="import-file">
              Dosya (.csv veya .json)
            </label>
            <Input
              id="import-file"
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,text/plain,application/json"
              className="py-2"
              disabled={pending}
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Zorunlu kolonlar: {requiredLabels}. En fazla {IMPORT_MAX_ROWS.toLocaleString("tr-TR")} satır. Excel’de{" "}
              <em>Farklı Kaydet → CSV UTF-8</em> ile kaydedin.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={runPreview} disabled={!file || !brandId || pending}>
              {pending && !preview ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
              Ön izle
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{error.message}</AlertTitle>
          {error.details.length > 0 && (
            <AlertDescription>
              <ul className="list-disc pl-4">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </AlertDescription>
          )}
        </Alert>
      )}

      {preview && <PreviewPanel preview={preview} brandName={brandName} pending={pending} onApply={runApply} onCancel={runCancel} />}

      <ImportHistory rows={history} />
    </div>
  )
}

function AppliedSummary({ result }: { result: ImportPreviewResult }) {
  return (
    <Alert variant="success">
      <CheckCircle2 />
      <AlertTitle>İçe aktarma tamamlandı — {result.fileName}</AlertTitle>
      <AlertDescription>
        {result.counts.created} yeni ürün, {result.counts.updated} güncelleme, {result.counts.skipped} atlanan, {result.counts.error} hatalı
        satır.{" "}
        <Link href="/admin/catalog" className="underline underline-offset-2">
          Katalogu aç
        </Link>
      </AlertDescription>
    </Alert>
  )
}

function CountTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${tone}`}>{value.toLocaleString("tr-TR")}</p>
    </div>
  )
}

function PreviewPanel({
  preview,
  brandName,
  pending,
  onApply,
  onCancel,
}: {
  preview: ImportPreviewResult
  brandName: string
  pending: boolean
  onApply: () => void
  onCancel: () => void
}) {
  const { counts } = preview
  const nothingToDo = counts.created === 0 && counts.updated === 0

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Ön izleme — {preview.fileName}</h2>
          <p className="text-sm text-muted-foreground">
            {brandName || preview.brandName} · {CATALOG_IMPORT_MODE_LABELS[preview.mode]}
            {preview.pricesIncludeVat && " · fiyatlar KDV dahil okundu"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <CountTile label="Toplam satır" value={counts.total} tone="text-foreground" />
          <CountTile label="Yeni" value={counts.created} tone="text-success-strong" />
          <CountTile label="Güncellenecek" value={counts.updated} tone="text-foreground" />
          <CountTile label="Atlanan" value={counts.skipped} tone="text-muted-foreground" />
          <CountTile label="Hatalı" value={counts.error} tone="text-destructive-strong" />
        </div>

        {preview.truncated && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Dosya satır sınırını aştı</AlertTitle>
            <AlertDescription>
              Yalnız ilk {IMPORT_MAX_ROWS.toLocaleString("tr-TR")} satır okundu. Dosyayı bölerek yükleyin.
            </AlertDescription>
          </Alert>
        )}

        {preview.unknownHeaders.length > 0 && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Tanınmayan kolonlar yok sayıldı</AlertTitle>
            <AlertDescription>{preview.unknownHeaders.join(", ")}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue={counts.error > 0 ? "errors" : "creates"}>
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="creates">Yeni ({counts.created})</TabsTrigger>
            <TabsTrigger value="updates">Güncellenecek ({counts.updated})</TabsTrigger>
            <TabsTrigger value="skips">Atlanan ({counts.skipped})</TabsTrigger>
            <TabsTrigger value="errors">Hatalı ({counts.error})</TabsTrigger>
          </TabsList>

          <TabsContent value="creates">
            <PreviewRows rows={preview.creates} total={counts.created} emptyLabel="Yeni ürün yok." />
          </TabsContent>
          <TabsContent value="updates">
            <PreviewRows rows={preview.updates} total={counts.updated} emptyLabel="Güncellenecek ürün yok." />
          </TabsContent>
          <TabsContent value="skips">
            <PreviewRows rows={preview.skips} total={counts.skipped} emptyLabel="Atlanan satır yok." showNote />
          </TabsContent>
          <TabsContent value="errors">
            {preview.issues.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Hatalı satır yok.</p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Satır</TableHead>
                      <TableHead className="w-40">Ürün Kodu</TableHead>
                      <TableHead>Hata</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.issues.map((issue, index) => (
                      <TableRow key={`${issue.line}-${index}`}>
                        <TableCell className="tabular-nums">{issue.line}</TableCell>
                        <TableCell className="font-mono text-xs">{issue.sku || "—"}</TableCell>
                        <TableCell className="text-sm text-destructive-strong">{issue.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {preview.issuesTruncated && (
                  <p className="p-3 text-xs text-muted-foreground">
                    İlk {preview.issues.length} hata gösteriliyor. Dosyayı düzeltip tekrar yükleyin.
                  </p>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Alert>
          <AlertDescription>
            Hatalı satırlar yazılmaz, geri kalan satırlar uygulanır. Uygulamadan sonra parti geçmişte kalıcı olarak görünür.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onApply} disabled={pending || nothingToDo}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {counts.created} yeni + {counts.updated} güncellemeyi uygula
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Vazgeç
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function PreviewRows({
  rows,
  total,
  emptyLabel,
  showNote = false,
}: {
  rows: ImportPreviewRow[]
  total: number
  emptyLabel: string
  showNote?: boolean
}) {
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">{emptyLabel}</p>

  return <PaginatedPreviewRows rows={rows} total={total} showNote={showNote} />
}

function PaginatedPreviewRows({ rows, total, showNote }: { rows: ImportPreviewRow[]; total: number; showNote: boolean }) {
  const { page, pageCount, pageItems, setPage } = useDashboardPage(rows, PREVIEW_PAGE_SIZE)

  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Satır</TableHead>
              <TableHead className="w-40">Ürün Kodu</TableHead>
              <TableHead>Ürün</TableHead>
              {showNote ? (
                <TableHead>Gerekçe</TableHead>
              ) : (
                <>
                  <TableHead className="text-right">Fiyat (KDV hariç)</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((row) => (
              <TableRow key={`${row.line}-${row.sku}`}>
                <TableCell className="tabular-nums">{row.line}</TableCell>
                <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                <TableCell className="text-sm">{row.name || "—"}</TableCell>
                {showNote ? (
                  <TableCell className="text-sm text-muted-foreground">{row.note}</TableCell>
                ) : (
                  <>
                    <TableCell className="text-right tabular-nums">{formatKurus(row.workshopPriceKurus)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.stockQty}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {total > rows.length && (
        <p className="p-3 text-xs text-muted-foreground">
          {total.toLocaleString("tr-TR")} satırdan ilk {rows.length} tanesi gösteriliyor.
        </p>
      )}
      <DashboardPagination page={page} pageCount={pageCount} onPageChange={setPage} />
    </div>
  )
}

function ImportHistory({ rows }: { rows: CatalogImportHistoryRow[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Son içe aktarmalar</h2>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">Henüz içe aktarma yapılmadı.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dosya</TableHead>
              <TableHead>Marka</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="text-right">Yeni</TableHead>
              <TableHead className="text-right">Güncel</TableHead>
              <TableHead className="text-right">Atlanan</TableHead>
              <TableHead className="text-right">Hatalı</TableHead>
              <TableHead>Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <p className="text-sm font-medium text-foreground">{row.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {CATALOG_IMPORT_MODE_LABELS[row.mode]}
                    {row.pricesIncludeVat && " · KDV dahil"} · {row.actorLabel}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{row.brandName}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.createdCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.updatedCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.skippedCount}</TableCell>
                <TableCell className="text-right tabular-nums">{row.errorCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.appliedAt ?? row.createdAt).toLocaleString("tr-TR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
