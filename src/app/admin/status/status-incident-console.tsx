"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, ExternalLink, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { typedResolver } from "@/lib/validations/resolver"
import {
  createStatusIncidentSchema,
  resolveStatusIncidentSchema,
  STATUS_INCIDENT_SEVERITIES,
  type CreateStatusIncidentInput,
  type ResolveStatusIncidentInput,
} from "@/lib/validations/status-incident"
import { createStatusIncidentAction, resolveStatusIncidentAction } from "@/app/admin/status/actions"
import { deriveOverallStatus, OVERALL_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/status-page"

export interface AdminStatusIncidentRow {
  id: string
  title: string
  severity: "degraded" | "major_outage"
  message: string
  createdByEmail: string
  resolvedAt: string | null
  resolutionNote: string | null
  createdAt: string
}

export function StatusIncidentConsole({
  incidents,
  activeSeverities,
}: {
  incidents: AdminStatusIncidentRow[]
  activeSeverities: AdminStatusIncidentRow["severity"][]
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [resolving, setResolving] = useState<AdminStatusIncidentRow | null>(null)

  const overallStatus = deriveOverallStatus(activeSeverities)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Durum Sayfası</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Herkese açık{" "}
            <Link href="/status" target="_blank" className="inline-flex items-center gap-1 text-primary hover:underline">
              durum sayfası <ExternalLink className="size-3" aria-hidden="true" />
            </Link>{" "}
            için yayınlanan olayları buradan yönetin.
          </p>
        </div>
        <Button size="lg" className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden="true" /> Yeni Olay Yayınla
        </Button>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm",
          overallStatus === "operational"
            ? "bg-success/10 border-success/20"
            : overallStatus === "degraded"
              ? "bg-warning/10 border-warning/20"
              : "bg-destructive/10 border-destructive/20"
        )}
      >
        {overallStatus === "operational" ? (
          <CheckCircle2 className="size-5 text-success-strong" aria-hidden="true" />
        ) : (
          <AlertTriangle
            className={cn(
              "size-5",
              overallStatus === "degraded" ? "text-warning-strong" : "text-destructive-strong"
            )}
            aria-hidden="true"
          />
        )}
        <span
          className={cn(
            "font-medium",
            overallStatus === "operational"
              ? "text-success-strong"
              : overallStatus === "degraded"
                ? "text-warning-strong"
                : "text-destructive-strong"
          )}
        >
          {OVERALL_STATUS_LABELS[overallStatus]}
        </span>
      </div>

      <div className="space-y-3">
        {incidents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz yayınlanmış bir olay yok.</p>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="rounded-lg border bg-card p-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{incident.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        incident.resolvedAt
                          ? "bg-muted text-muted-foreground"
                          : incident.severity === "major_outage"
                            ? "bg-destructive/15 text-destructive-strong"
                            : "bg-warning/15 text-warning-strong"
                      )}
                    >
                      {incident.resolvedAt ? "Çözüldü" : SEVERITY_LABELS[incident.severity]}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{incident.message}</p>
                  {incident.resolutionNote && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Çözüm notu: {incident.resolutionNote}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(incident.createdAt).toLocaleString("tr-TR")} · {incident.createdByEmail}
                  </p>
                </div>
                {!incident.resolvedAt && (
                  <Button size="lg" variant="outline" onClick={() => setResolving(incident)}>
                    Çöz
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {createOpen && (
        <CreateIncidentDialog
          onOpenChange={setCreateOpen}
          onSaved={() => {
            setCreateOpen(false)
            router.refresh()
          }}
        />
      )}

      {resolving && (
        <ResolveIncidentDialog
          key={resolving.id}
          incident={resolving}
          onOpenChange={(open) => !open && setResolving(null)}
          onSaved={() => {
            setResolving(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function CreateIncidentDialog({
  onOpenChange,
  onSaved,
}: {
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<CreateStatusIncidentInput, unknown, CreateStatusIncidentInput>({
    resolver: typedResolver(createStatusIncidentSchema),
    defaultValues: { title: "", severity: "degraded", message: "" },
  })

  function onSubmit(values: CreateStatusIncidentInput) {
    setError(null)
    startTransition(async () => {
      const result = await createStatusIncidentAction(values)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success("Olay yayınlandı")
      onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Olay</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Örn: WhatsApp bildirimlerinde gecikme" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ciddiyet *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(v) => field.onChange(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_INCIDENT_SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {SEVERITY_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama *</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} placeholder="Müşterilere görünecek kısa açıklama" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Vazgeç
              </Button>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? <BrandSpinner size={18} label="Yayınlanıyor…" /> : "Yayınla"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ResolveIncidentDialog({
  incident,
  onOpenChange,
  onSaved,
}: {
  incident: AdminStatusIncidentRow
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<ResolveStatusIncidentInput, unknown, ResolveStatusIncidentInput>({
    resolver: typedResolver(resolveStatusIncidentSchema),
    defaultValues: { incidentId: incident.id, resolutionNote: "" },
  })

  function onSubmit(values: ResolveStatusIncidentInput) {
    setError(null)
    startTransition(async () => {
      const result = await resolveStatusIncidentAction(values)
      if (!result.ok) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success("Olay çözüldü olarak işaretlendi")
      onSaved()
    })
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Olayı Çöz — {incident.title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="resolutionNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Çözüm notu (isteğe bağlı)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder="Örn: Sağlayıcı sorunu giderildi, izleniyor." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
                Vazgeç
              </Button>
              <Button type="submit" size="lg" disabled={pending}>
                {pending ? (
                  <BrandSpinner size={18} label="İşaretleniyor…" />
                ) : (
                  "Çözüldü Olarak İşaretle"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
