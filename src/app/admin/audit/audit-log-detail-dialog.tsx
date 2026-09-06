"use client"

import { ChevronRight, FileClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { auditMetadataSummary, parseAuditMetadata } from "@/lib/admin/audit-metadata"

interface AuditLogDetailDialogProps {
  actionLabel: string
  metadataJson: string | null
  workshopName: string
  actorLabel: string
  dateLabel: string
  entityLabel: string
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-xs text-foreground">{label}</p>
      <p className="truncate font-medium text-foreground">{value}</p>
    </div>
  )
}

export function AuditLogDetailDialog({
  actionLabel,
  metadataJson,
  workshopName,
  actorLabel,
  dateLabel,
  entityLabel,
}: AuditLogDetailDialogProps) {
  const metadata = parseAuditMetadata(metadataJson)
  const hasContent = metadata.changes.length > 0 || metadata.details.length > 0 || metadata.raw

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="-m-1 h-auto w-full min-w-72 justify-between gap-3 whitespace-normal p-1 text-left"
          aria-label={`${actionLabel} kaydının ayrıntılarını görüntüle`}
        >
          <span className="min-w-0">
            <span className="block font-medium text-foreground">{actionLabel}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {auditMetadataSummary(metadata)}
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <FileClock className="size-5 text-primary" aria-hidden="true" />
            <DialogTitle>{actionLabel}</DialogTitle>
          </div>
          <DialogDescription>Denetim kaydının bağlamı ve işlem sırasında kaydedilen değerler.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
          <ContextItem label="İş yeri" value={workshopName} />
          <ContextItem label="Yapan" value={actorLabel} />
          <ContextItem label="Tarih" value={dateLabel} />
          <ContextItem label="Kayıt türü" value={entityLabel} />
        </div>

        {metadata.changes.length > 0 && (
          <section className="space-y-2" aria-labelledby="audit-change-heading">
            <div>
              <h3 id="audit-change-heading" className="font-semibold text-foreground">Değişiklik karşılaştırması</h3>
              <p className="text-xs text-muted-foreground">İşlemden önceki ve sonraki değerler alan bazında gösterilir.</p>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">Alan</TableHead>
                    <TableHead className="w-1/3">Önce</TableHead>
                    <TableHead className="w-1/3">Sonra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metadata.changes.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="whitespace-normal align-top font-medium text-foreground">{row.label}</TableCell>
                      <TableCell className="whitespace-pre-wrap break-words align-top font-mono text-xs text-foreground">{row.before}</TableCell>
                      <TableCell className="whitespace-pre-wrap break-words align-top font-mono text-xs text-foreground">{row.after}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        )}

        {metadata.details.length > 0 && (
          <section className="space-y-2" aria-labelledby="audit-detail-heading">
            <h3 id="audit-detail-heading" className="font-semibold text-foreground">Ayrıntılar</h3>
            <dl className="grid overflow-hidden rounded-lg border sm:grid-cols-2">
              {metadata.details.map((detail) => (
                <div key={detail.key} className="min-w-0 space-y-1 border-b p-3 last:border-b-0 sm:border-r sm:even:border-r-0">
                  <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                  <dd className="whitespace-pre-wrap break-words font-mono text-xs text-foreground">{detail.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {metadata.raw && (
          <section className="space-y-2" aria-labelledby="audit-raw-heading">
            <h3 id="audit-raw-heading" className="font-semibold text-foreground">Ham kayıt ayrıntısı</h3>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-mono text-xs text-foreground">{metadata.raw}</pre>
          </section>
        )}

        {!hasContent && <p className="py-6 text-center text-sm text-muted-foreground">Bu işlem için ek ayrıntı kaydedilmemiş.</p>}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Kapat</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
