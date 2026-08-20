"use client"

import { useState, useTransition } from "react"
import { Pencil, Play, Timer } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  LABOR_SESSION_NOTE_MAX,
  laborSessionEditFormSchema,
  laborSessionNoteSchema,
  type LaborSessionEditFormInput,
  type LaborSessionNoteInput,
} from "@/lib/validations/technician"
import { formatMinutes } from "@/lib/format"
import { formatDateTime } from "@/lib/utils-client"
import {
  startLaborSessionAction,
  stopLaborSessionAction,
  updateLaborSessionAction,
} from "@/app/(app)/technician/actions"

/**
 * Teknisyen panelindeki "İşçilik Süresi" bloğu (BAK-138).
 *
 * BAK-138 öncesi burada yalnız sayaç vardı: başlat/durdur, sonuç "18:40 → 19:25"
 * satırı. Atölye "bu sürede ne yapıldı" sorusuna cevap veremiyordu ve yanlış
 * basılmış bir başlat/durdur düzeltilemiyordu. Eklenenler:
 *  - durdururken açıklama (zorunlu DEĞİL — sayacı durdurmak yavaşlamamalı),
 *  - bitmiş kaydın açıklamasını ve saatlerini sonradan düzeltme,
 *  - düzeltilmiş kayıtta görünür "elle düzeltildi" izi.
 */

export type TechnicianLaborSessionRow = {
  id: string
  startTime: string
  endTime: string | null
  durationMinutes: number | null
  note: string | null
  editedAt: string | null
  editedByName: string | null
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

/**
 * ISO (UTC) → `datetime-local` girdisinin beklediği YEREL saat metni
 * ("2026-08-19T18:40"). `toISOString()` kullanılamaz: o UTC yazar ve alan
 * atölyenin saatinden kaymış görünür.
 */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── Sayacı durdurma (açıklama sorar) ─────────────────────────────────────────

/**
 * Aktif sayacın "Durdur" düğmesi. Sayfa başındaki canlı işçilik şeridinde
 * kullanılır; kart ile aynı akışı paylaştığı için burada durur.
 */
export function StopLaborButton({
  orderId,
  className,
}: {
  orderId: string
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<LaborSessionNoteInput, unknown, LaborSessionNoteInput>({
    resolver: typedResolver(laborSessionNoteSchema),
    defaultValues: { note: "" },
  })

  function submit(values: LaborSessionNoteInput) {
    setServerError(null)
    startTransition(async () => {
      const res = await stopLaborSessionAction(orderId, values.note ?? "")
      if (res && "error" in res && res.error) {
        setServerError(res.error)
        return
      }
      toast.success("İşçilik durduruldu.")
      setOpen(false)
      form.reset({ note: "" })
      router.refresh()
    })
  }

  return (
    <>
      <Button
        variant="destructive"
        size="lg"
        onClick={() => setOpen(true)}
        disabled={isPending}
        className={className}
      >
        <Timer /> Durdur
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setServerError(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İşçiliği durdur</DialogTitle>
            <DialogDescription>
              Bu sürede ne yaptığını yazabilirsin. Zorunlu değil — boş bırakıp sonradan da ekleyebilirsin.
            </DialogDescription>
          </DialogHeader>

          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Açıklama</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={3}
                        maxLength={LABOR_SESSION_NOTE_MAX}
                        placeholder="Örn. Balata söküldü, disk ölçüldü"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                  Vazgeç
                </Button>
                <Button type="submit" variant="destructive" disabled={isPending}>
                  Durdur
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Bitmiş kaydı düzeltme ────────────────────────────────────────────────────

function EditLaborSessionDialog({
  session,
  onOpenChange,
}: {
  session: TechnicianLaborSessionRow | null
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<LaborSessionEditFormInput, unknown, LaborSessionEditFormInput>({
    resolver: typedResolver(laborSessionEditFormSchema),
    defaultValues: { startLocal: "", endLocal: "", note: "" },
    // `values`: seçili kayıt değişince alanlar RHF tarafından yeniden doldurulur.
    values:
      session && session.endTime
        ? {
            startLocal: toDatetimeLocalValue(session.startTime),
            endLocal: toDatetimeLocalValue(session.endTime),
            note: session.note ?? "",
          }
        : undefined,
  })

  function submit(values: LaborSessionEditFormInput) {
    if (!session) return
    setServerError(null)
    const fd = new FormData()
    // Yerel saat metni burada UTC'ye çevrilir — sunucu ISO bekler.
    fd.set("startTime", new Date(values.startLocal).toISOString())
    fd.set("endTime", new Date(values.endLocal).toISOString())
    fd.set("note", values.note ?? "")
    startTransition(async () => {
      const res = await updateLaborSessionAction(session.id, fd)
      if (res && "error" in res && res.error) {
        setServerError(res.error)
        return
      }
      toast.success("İşçilik kaydı güncellendi.")
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={session != null}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setServerError(null)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>İşçilik kaydını düzenle</DialogTitle>
          <DialogDescription>
            Saatleri düzeltirsen süre otomatik yeniden hesaplanır. Düzeltme, iş emri işlem geçmişine
            kimin ne zaman yaptığıyla birlikte yazılır.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <FormField
                control={form.control}
                name="startLocal"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Başlangıç</FormLabel>
                    <FormControl>
                      <DateTimePicker {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endLocal"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Bitiş</FormLabel>
                    <FormControl>
                      <DateTimePicker {...field} />
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
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={3}
                      maxLength={LABOR_SESSION_NOTE_MAX}
                      placeholder="Bu sürede ne yapıldı?"
                    />
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
                Kaydet
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Kart ─────────────────────────────────────────────────────────────────────

export function LaborSessionCard({
  orderId,
  sessions,
  locked,
  canStart,
  canEdit,
}: {
  orderId: string
  sessions: TechnicianLaborSessionRow[]
  /** İş emri teslim/iptal — hiçbir yazma yapılamaz. */
  locked: boolean
  /** Sayaç başlatılabilir mi (iş emri durumu uygun mu). */
  canStart: boolean
  /** Kullanıcı `order.edit` taşıyor mu — bitmiş kaydı geriye dönük düzeltme yetkisi. */
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<TechnicianLaborSessionRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const activeSession = sessions.find((s) => !s.endTime)
  const finished = sessions.filter((s) => s.endTime)
  const totalMinutes = finished.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0)

  function handleStart() {
    startTransition(async () => {
      const res = await startLaborSessionAction(orderId)
      if (res && "error" in res && res.error) toast.error(res.error)
      router.refresh()
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Timer className="size-4 text-muted-foreground" />
          İşçilik Süresi
        </h3>
        {totalMinutes > 0 && (
          <span className="text-sm font-medium text-foreground">Toplam: {formatMinutes(totalMinutes)}</span>
        )}
      </div>

      {!activeSession && !locked && (
        <Button
          variant="success"
          size="lg"
          onClick={handleStart}
          disabled={isPending || !canStart}
          className="touch-manipulation"
        >
          <Play className="size-4" />
          İşçilik Başlat
        </Button>
      )}

      {finished.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {finished.map((session) => (
            <li key={session.id} className="space-y-1 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  {formatTime(session.startTime)} → {formatTime(session.endTime!)}
                </span>
                <span className="ml-auto font-medium">
                  {/* `!= null`: 0 dakikalık kayıt da bir süredir, "—" değil. */}
                  {session.durationMinutes != null ? formatMinutes(session.durationMinutes) : "—"}
                </span>
                {canEdit && !locked && (
                  <Button
                    variant="ghost"
                    size="icon-compact"
                    aria-label="İşçilik kaydını düzenle"
                    onClick={() => setEditing(session)}
                    className="-my-1 shrink-0 touch-manipulation"
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
              {session.note ? (
                <p className="break-words whitespace-pre-wrap text-foreground">{session.note}</p>
              ) : (
                canEdit && !locked && <p className="text-muted-foreground">Açıklama yok</p>
              )}
              {session.editedAt && (
                <p className="text-[11px] text-muted-foreground">
                  Elle düzeltildi · {formatDateTime(session.editedAt)}
                  {session.editedByName ? ` · ${session.editedByName}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <EditLaborSessionDialog session={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </div>
  )
}
