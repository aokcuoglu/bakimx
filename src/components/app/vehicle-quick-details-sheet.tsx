"use client"

import { useState, type ReactNode } from "react"
import { Info, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/shared/bottom-sheet"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { buildVehicleQuickFields, type VehicleQuickFieldsInput } from "@/lib/vehicle-quick-fields"

type VehicleQuickDetails = VehicleQuickFieldsInput & {
  vin: string | null
  vinConfirmed: boolean
}

function QuickFieldBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground font-medium">{label}</dt>
      <dd className="text-sm font-semibold text-foreground mt-0.5">{value}</dd>
    </div>
  )
}

export function VehicleQuickDetailsSheet({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false)
  const [vehicle, setVehicle] = useState<VehicleQuickDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && !vehicle && !loading) {
      setLoading(true)
      setError(false)
      fetch(`/api/vehicles/${vehicleId}`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (!data || typeof data !== "object" || "error" in data) {
            setError(true)
            return
          }
          setVehicle(data as VehicleQuickDetails)
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false))
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={handleOpenChange}
      title="Araç Detayları"
      trigger={
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground">
          <Info className="size-4 mr-1" /> Detay
        </Button>
      }
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <BrandSpinner size={40} />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground py-4">Araç bilgileri yüklenemedi.</p>
      ) : vehicle ? (
        <div className="space-y-3 pb-2">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {buildVehicleQuickFields(vehicle).map((f) => (
              <QuickFieldBox key={f.label} label={f.label} value={f.value} />
            ))}
            <QuickFieldBox
              label="Şase No"
              value={<span className="font-mono text-xs">{vehicle.vin || "—"}</span>}
            />
            <QuickFieldBox
              label="Şase Teyit"
              value={
                vehicle.vinConfirmed ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <ShieldCheck className="size-3" /> Teyit Edildi
                  </span>
                ) : (
                  <span className="text-warning">Teyit Bekliyor</span>
                )
              }
            />
          </dl>
          <a
            href={`/vehicles/${vehicleId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-block"
          >
            Tüm geçmişi görüntüle →
          </a>
        </div>
      ) : null}
    </BottomSheet>
  )
}
