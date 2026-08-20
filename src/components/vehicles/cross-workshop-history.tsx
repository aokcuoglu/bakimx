"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Building2, Lock, ScanLine, ShieldCheck, Wrench } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusBadge } from "@/components/shared/status-badge"
import { formatDate } from "@/lib/utils-client"
import {
  arrivalReasonLabel,
  vehicleTypeLabel,
  fuelTypeLabel,
  DAMAGE_TYPES,
  DAMAGE_SEVERITY,
} from "@/lib/constants"
import type { CrossWorkshopHistory } from "@/lib/vehicle-history/types"

/**
 * Aracın BAŞKA servislerdeki geçmişi (BAK-77).
 *
 * İki hâli vardır ve fark bilerek görünürdür:
 *   • **Kilitli** — araç başka serviste kayıtlı ama bu atölye ruhsatı okutmadı.
 *     Sayaçlar ve marka/model görünür, kişisel alanlar `***`. Kullanıcıya kilidi
 *     nasıl açacağı tek cümleyle söylenir.
 *   • **Açık** — ruhsat okutuldu ya da atölyenin bu araç için kendi kaydı var.
 *
 * HİÇBİR hâlde tutar/fiyat gösterilmez; veri katmanı zaten taşımaz.
 */
export function CrossWorkshopHistoryCard({
  history,
  /**
   * Araç detay sayfasında iş emirleri, kendi kayıtlarıyla BİRLİKTE tek bir
   * "İş Emri Geçmişi" listesinde gösterilir; orada tekrar basılmasınlar diye
   * kapatılabilir.
   */
  showOrders = true,
}: {
  history: CrossWorkshopHistory
  showOrders?: boolean
}) {
  if (history.workshopCount === 0) return null

  const { locked } = history

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-muted-foreground" />
          Diğer Servislerdeki Geçmiş
          <span className="text-xs font-normal text-muted-foreground">({history.orderCount})</span>
        </CardTitle>
        <span
          className={
            locked
              ? "inline-flex items-center gap-1 text-[11px] font-medium text-warning-strong"
              : "inline-flex items-center gap-1 text-[11px] font-medium text-success-strong"
          }
        >
          {locked ? <Lock className="size-3" /> : <ShieldCheck className="size-3" />}
          {locked ? "KVKK maskeli" : "Erişim açık"}
        </span>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Servis" value={String(history.workshopCount)} />
          <Stat label="İş Emri" value={String(history.orderCount)} />
          <Stat
            label="Son İşlem"
            value={history.lastServicedAt ? formatDate(history.lastServicedAt) : "—"}
          />
        </div>

        {locked ? (
          <Alert variant="warning">
            <ScanLine className="size-4" />
            <AlertDescription>
              Bu araç {history.workshopCount} başka serviste kayıtlı. Sahip ve geçmiş bilgileri
              KVKK gereği maskelidir — <strong>ruhsatı okuttuğunuzda</strong> tamamı açılır.
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-xs text-muted-foreground">
            {history.accessReason === "registration_scan"
              ? "Ruhsat bu serviste okutulduğu için geçmiş açık."
              : "Bu aracı daha önce servis ettiğiniz için geçmiş açık."}{" "}
            Diğer servislerin fiyatlandırması hiçbir koşulda paylaşılmaz.
          </p>
        )}

        {history.owner ? (
          <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
            <p className="text-[11px] font-medium text-muted-foreground">Kayıtlı Sahip</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{history.owner.name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{history.owner.phone}</span>
              {history.owner.email ? <span className="truncate">{history.owner.email}</span> : null}
              {history.owner.city ? <span>{history.owner.city}</span> : null}
            </div>
          </div>
        ) : null}

        {history.vehicle ? (
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <Field label="Marka" value={history.vehicle.brand} />
            <Field label="Model" value={history.vehicle.model} />
            <Field label="Araç Tipi" value={vehicleTypeLabel(history.vehicle.vehicleType)} />
            <Field
              label="Model Yılı"
              value={history.vehicle.modelYear ? String(history.vehicle.modelYear) : null}
            />
            <Field label="Renk" value={history.vehicle.color} />
            <Field label="Yakıt" value={fuelTypeLabel(history.vehicle.fuelType)} />
            <Field label="Şase No" value={history.vehicle.vin} mono />
            <Field label="Motor No" value={history.vehicle.engineNo} mono />
            <Field
              label="Son Bilinen KM"
              value={
                history.vehicle.lastKnownMileage
                  ? `${history.vehicle.lastKnownMileage.toLocaleString("tr-TR")} km`
                  : null
              }
            />
          </dl>
        ) : null}

        {showOrders && history.orders.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Wrench className="size-3" />
              İş Emri Geçmişi
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {history.orders.map((o) => (
                <div key={o.key} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <WorkshopChip name={o.workshopName} city={o.workshopCity} />
                    <StatusBadge status={o.status} />
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatDate(o.servicedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {o.complaint ? <span className="truncate">{o.complaint}</span> : null}
                    {o.arrivalReason ? <span>{arrivalReasonLabel(o.arrivalReason)}</span> : null}
                    {o.mileage ? <span>{o.mileage.toLocaleString("tr-TR")} km</span> : null}
                  </div>
                  {o.itemLabels.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {o.itemLabels.map((label, i) => (
                        <span
                          key={`${o.key}-i${i}`}
                          className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[11px] text-muted-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {history.damageMarks.length > 0 ? (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <AlertTriangle className="size-3" />
              Diğer Servislerde Kaydedilen Hasarlar ({history.damageMarks.length})
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {history.damageMarks.map((dm) => {
                const dt = DAMAGE_TYPES[dm.damageType as keyof typeof DAMAGE_TYPES]
                const sev = DAMAGE_SEVERITY[dm.severity as keyof typeof DAMAGE_SEVERITY]
                return (
                  <div key={dm.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="text-xs font-semibold text-foreground">{dm.zone}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {dt?.label || dm.damageType} · {sev?.label || dm.severity}
                    </span>
                    <WorkshopChip name={dm.workshopName} />
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatDate(dm.markedAt)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Aracın hangi serviste işlem gördüğünü gösteren künye çipi. Kilitli hâlde ad
 * `***` gelir; çip yine basılır ki "başka bir servis" olduğu belli olsun.
 */
export function WorkshopChip({ name, city }: { name: string; city?: string | null }) {
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-border bg-muted px-2 text-[11px] font-medium text-muted-foreground">
      <Building2 className="size-3" />
      {name}
      {city ? <span className="text-muted-foreground">· {city}</span> : null}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-0.5 font-mono text-xs text-foreground" : "mt-0.5 text-sm font-semibold text-foreground"}>
        {value || "—"}
      </dd>
    </div>
  )
}

/**
 * İstemci tarafı yükleyici — henüz kaydedilmemiş bir plaka için (sihirbazın araç
 * adımı) ya da mevcut bir araç için geçmişi çeker. Sunucu bileşeninden veri
 * geçirilebilen yerlerde `CrossWorkshopHistoryCard` doğrudan kullanılır.
 */
export function CrossWorkshopHistoryLoader({
  plate,
  vehicleId,
  /** Değiştiğinde yeniden çeker — ruhsat okutulduktan sonra kilidi tazelemek için. */
  refreshKey,
}: {
  plate?: string
  vehicleId?: string
  refreshKey?: string | number
}) {
  const [history, setHistory] = useState<CrossWorkshopHistory | null>(null)

  useEffect(() => {
    const query = vehicleId
      ? `vehicleId=${encodeURIComponent(vehicleId)}`
      : plate
        ? `plate=${encodeURIComponent(plate)}`
        : ""
    if (!query) {
      const clear = setTimeout(() => setHistory(null), 0)
      return () => clearTimeout(clear)
    }
    let active = true
    // Sihirbazda plaka harf harf yazılıyor; her tuşta sorgu atmamak için beklet.
    const t = setTimeout(() => {
      fetch(`/api/vehicle-history?${query}`)
        .then((r) => r.json())
        .then((d: CrossWorkshopHistory & { error?: string }) => {
          if (!active || d?.error) return
          setHistory(d)
        })
        .catch(() => {})
    }, 400)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [plate, vehicleId, refreshKey])

  if (!history || history.workshopCount === 0) return null
  return <CrossWorkshopHistoryCard history={history} />
}
