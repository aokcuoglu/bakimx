"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Ban, Loader2, MoreHorizontal, Package, Pencil, Plus, RotateCcw, TriangleAlert } from "lucide-react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { PARTS_REQUEST_STATUS } from "@/lib/constants"
import { typedResolver } from "@/lib/validations/resolver"
import {
  partsRequestCancelSchema,
  partsRequestEditSchema,
  type PartsRequestCancelInput,
  type PartsRequestEditInput,
} from "@/lib/validations/technician"
import { findUndecidedPartsRequests, isPartsRequestDecided } from "@/lib/orders/parts-request-guard"
import {
  cancelPartsRequestAction,
  convertPartsRequestToOrderItemAction,
  reopenPartsRequestAction,
  updatePartsRequestAction,
} from "@/app/(app)/technician/actions"

export interface PartsRequestRow {
  id: string
  partName: string
  partSku: string | null
  brand: string | null
  tecdocArticleId: number | null
  quantity: number
  note: string | null
  status: string
  createdAt: string
  requestedByName: string | null
  convertedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
}

/**
 * Ustanın sahadan gönderdiği parça talepleri ve OFİS KARARI.
 *
 * Her talebin iki çıkışı vardır: "Kaleme Ekle" (talep iş emri kalemine döner,
 * fiyat ofiste girilir) ya da "İptal Et" (parça alınmayacak, gerekçesiyle).
 * Karar verilmemiş talep varken iş emri teslime alınamaz — kural sunucuda
 * uygulanır (bkz. @/lib/orders/parts-request-guard), buradaki uyarı onun
 * görünen yüzü.
 *
 * Kaleme eklenmiş talep artık DEĞİŞTİRİLEMEZ: kalem ayrı bir kayıttır, düzeltme
 * o satırda yapılır. İptal ise geri alınabilir (yanlış karar ucuz olsun).
 *
 * Rozet renkleri teknisyen tarafındaki PARTS_REQUEST_STATUS ile paylaşılır
 * (@/lib/constants) — iki taraf arasında tutarlılık için tek kaynak.
 */
export function PartsRequestPanel({
  requests,
  locked,
  onError,
}: {
  requests: PartsRequestRow[]
  locked: boolean
  onError: (msg: string) => void
}) {
  const [editing, setEditing] = useState<PartsRequestRow | null>(null)
  const [cancelling, setCancelling] = useState<PartsRequestRow | null>(null)

  // Karar bekleyenler üstte: ekranı açan kişinin yapacak işi listenin başında
  // dursun, kapanmış talepler aşağı insin. Grup içi sıra sunucudan geldiği gibi.
  const ordered = useMemo(() => {
    const undecided = requests.filter((r) => !isPartsRequestDecided(r))
    const decided = requests.filter((r) => isPartsRequestDecided(r))
    return [...undecided, ...decided]
  }, [requests])

  const undecidedCount = findUndecidedPartsRequests(requests).length

  if (requests.length === 0) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Package className="size-4" />
          Parça Talepleri
          <span className="text-xs font-normal text-muted-foreground/70">({requests.length})</span>
        </h3>
        {undecidedCount > 0 && (
          <span className="inline-flex items-center rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {undecidedCount} karar bekliyor
          </span>
        )}
      </div>

      {undecidedCount > 0 && !locked && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-strong" />
          <div className="min-w-0">
            <p className="font-medium">Karar bekleyen parça talebi var.</p>
            <p className="text-xs text-muted-foreground">
              Her talebi ya iş emrine kalem olarak ekleyin ya da iptal edin. Karar verilmeden iş emri
              teslime hazırlanamaz ve teslim edilemez.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {ordered.map((req) => (
          <PartsRequestCard
            key={req.id}
            request={req}
            locked={locked}
            onError={onError}
            onEdit={() => setEditing(req)}
            onCancel={() => setCancelling(req)}
          />
        ))}
      </div>

      <EditPartsRequestDialog request={editing} onOpenChange={(open) => { if (!open) setEditing(null) }} onError={onError} />
      <CancelPartsRequestDialog request={cancelling} onOpenChange={(open) => { if (!open) setCancelling(null) }} onError={onError} />
    </div>
  )
}

/** Tek talebin kartı: kimlik + durum + karar aksiyonları. */
function PartsRequestCard({
  request,
  locked,
  onError,
  onEdit,
  onCancel,
}: {
  request: PartsRequestRow
  locked: boolean
  onError: (msg: string) => void
  onEdit: () => void
  onCancel: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const status = (PARTS_REQUEST_STATUS as Record<string, { label: string; color: string }>)[request.status]
  const converted = request.convertedAt != null
  const cancelled = request.status === "cancelled"
  const decided = converted || cancelled

  function run(action: () => Promise<{ error?: string } | void>, successMessage: string) {
    startTransition(async () => {
      const res = await action()
      if (res && "error" in res && res.error) {
        onError(res.error)
        return
      }
      toast.success(successMessage)
    })
  }

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        // Karar bekleyen talep göz alsın; karara bağlanmış olan geri çekilsin.
        decided ? "border-transparent bg-muted" : "border-warning/20 bg-warning/[0.06]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium text-foreground break-words">{request.partName}</span>
            {request.partSku && <span className="font-mono text-xs text-muted-foreground">{request.partSku}</span>}
            {request.brand && <span className="text-xs text-muted-foreground">{request.brand}</span>}
            <span className="text-xs text-muted-foreground">×{request.quantity}</span>
          </div>
          {request.note && <p className="mt-0.5 text-xs text-muted-foreground break-words">{request.note}</p>}
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
            {request.requestedByName ? `${request.requestedByName} · ` : ""}
            {new Date(request.createdAt).toLocaleDateString("tr-TR")}
            {request.tecdocArticleId != null && " · Katalog parçası"}
          </p>
          {cancelled && request.cancelReason && (
            <p className="mt-1 text-xs text-muted-foreground break-words">
              <span className="font-medium text-destructive-strong">İptal gerekçesi:</span> {request.cancelReason}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
              status?.color,
            )}
          >
            {status?.label || request.status}
          </span>

          {converted && (
            <span className="inline-flex items-center rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-foreground">
              Kaleme eklendi
            </span>
          )}

          {!locked && !decided && (
            <>
              <Button
                variant="outline"
                size="lg"
                disabled={isPending}
                onClick={() => run(() => convertPartsRequestToOrderItemAction(request.id), "Talep kaleme eklendi")}
                className="touch-manipulation"
              >
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Kaleme Ekle
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={isPending}
                  aria-label={`${request.partName} için diğer işlemler`}
                  className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-50 md:size-9"
                >
                  <MoreHorizontal className="size-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="gap-2" onClick={onEdit}>
                    <Pencil className="size-4" />
                    Düzenle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-destructive-strong data-highlighted:text-destructive-strong"
                    onClick={onCancel}
                  >
                    <Ban className="size-4" />
                    Talebi İptal Et
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {!locked && cancelled && (
            <Button
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={() => run(() => reopenPartsRequestAction(request.id), "İptal geri alındı")}
              className="touch-manipulation"
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Geri Al
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Talep düzeltme modalı — usta yanlış parçayı ya da eksik miktarı göndermiş
 * olabilir; ofis kaleme eklemeden önce burada düzeltir.
 */
function EditPartsRequestDialog({
  request,
  onOpenChange,
  onError,
}: {
  request: PartsRequestRow | null
  onOpenChange: (open: boolean) => void
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<PartsRequestEditInput, unknown, PartsRequestEditInput>({
    resolver: typedResolver(partsRequestEditSchema),
    defaultValues: { partName: "", partSku: "", brand: "", quantity: 1, note: "" },
    // `values`: seçili talep değişince form alanları RHF tarafından yeniden
    // doldurulur — açılışta reset eden bir useEffect'e gerek kalmaz.
    values: request
      ? {
          partName: request.partName,
          partSku: request.partSku ?? "",
          brand: request.brand ?? "",
          quantity: request.quantity,
          note: request.note ?? "",
        }
      : undefined,
  })

  function submit(values: PartsRequestEditInput) {
    if (!request) return
    const fd = new FormData()
    fd.set("partName", values.partName)
    fd.set("partSku", values.partSku ?? "")
    fd.set("brand", values.brand ?? "")
    fd.set("quantity", String(values.quantity))
    fd.set("note", values.note ?? "")
    startTransition(async () => {
      const res = await updatePartsRequestAction(request.id, fd)
      if (res && "error" in res && res.error) {
        onError(res.error)
        return
      }
      toast.success("Parça talebi güncellendi")
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={request != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parça talebini düzenle</DialogTitle>
          <DialogDescription>
            Talep henüz kaleme eklenmedi; bilgileri düzeltebilirsiniz. Kaleme eklendikten sonra
            düzeltme iş emri kalemi üzerinden yapılır.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <FormField
              control={form.control}
              name="partName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parça adı</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Örn. Yağ pompası" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <FormField
                control={form.control}
                name="partSku"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Parça no / OEM</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Opsiyonel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Marka</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Opsiyonel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem className="sm:w-24">
                    <FormLabel>Miktar</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={1} max={999} inputMode="numeric" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Not</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} rows={2} placeholder="Opsiyonel — ör. acil, sol ön" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** Sık kullanılan iptal gerekçeleri — yazmadan tek dokunuşla seçilir. */
const CANCEL_REASON_PRESETS = [
  "Parça gerekmedi",
  "Müşteri onaylamadı",
  "Tedarik edilemedi",
  "Yanlış parça talebi",
] as const

/** İptal modalı: karar geri alınabilir olsa da gerekçesi kayıt altına alınır. */
function CancelPartsRequestDialog({
  request,
  onOpenChange,
  onError,
}: {
  request: PartsRequestRow | null
  onOpenChange: (open: boolean) => void
  onError: (msg: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<PartsRequestCancelInput, unknown, PartsRequestCancelInput>({
    resolver: typedResolver(partsRequestCancelSchema),
    defaultValues: { reason: "" },
    // Talep değişince gerekçe kutusu sıfırlanır: bir önceki iptalin metni yeni
    // talebe taşınmasın (`values` seçime bağlı yeniden doldurur).
    values: request ? { reason: "" } : undefined,
  })

  function close() {
    form.reset({ reason: "" })
    onOpenChange(false)
  }

  function submit(values: PartsRequestCancelInput) {
    if (!request) return
    startTransition(async () => {
      const res = await cancelPartsRequestAction(request.id, values.reason ?? "")
      if (res && "error" in res && res.error) {
        onError(res.error)
        return
      }
      toast.success("Parça talebi iptal edildi")
      close()
    })
  }

  return (
    <Dialog open={request != null} onOpenChange={(open) => { if (!open) close() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Parça talebini iptal et</DialogTitle>
          <DialogDescription>
            {request ? `"${request.partName}" talebi için parça alınmayacak.` : ""} Gerekçe atölye içinde
            kalır, müşteriye gösterilmez. Karar yanlışsa daha sonra geri alabilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {CANCEL_REASON_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="compact"
                  onClick={() => form.setValue("reason", preset, { shouldValidate: true })}
                  disabled={isPending}
                  className="touch-manipulation"
                >
                  {preset}
                </Button>
              ))}
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">İptal gerekçesi</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      maxLength={300}
                      placeholder="Gerekçe (opsiyonel)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={isPending}>
                Vazgeç
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
                Talebi İptal Et
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
