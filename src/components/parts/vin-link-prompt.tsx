"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, ScanLine } from "lucide-react"
import { VinCandidateList, VinLockedNotice } from "@/components/vehicles/vin-resolve"
import { linkVehicleCatalogAction } from "@/app/(app)/vehicles/actions"
import { isValidVin, type VinCandidate, type VinResolution } from "@/lib/vin/types"
import type { PickerVehicle } from "./tecdoc-part-picker"

/**
 * Shown on the Parça sekmesi when the vehicle has no catalogVehicleTypeId yet.
 * "VIN'den bağla" resolves the VIN against the local catalog and writes the
 * chosen engine variant back to the vehicle — no detour to the edit form. A
 * confident match links straight away; several variants surface a tappable
 * list; router.refresh() re-runs the page so the picker flips to the catalog.
 */
export function VinLinkPrompt({ vehicle }: { vehicle: PickerVehicle }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [locked, setLocked] = useState(false)
  const [candidates, setCandidates] = useState<VinCandidate[]>([])

  const hasVin = isValidVin(vehicle.vin ?? "")

  async function link(c: { vehicleTypeId: number; brandId: number; modelId: number }) {
    setLoading(true)
    setError("")
    const res = await linkVehicleCatalogAction(vehicle.id, {
      catalogVehicleTypeId: c.vehicleTypeId,
      catalogBrandId: c.brandId,
      catalogModelId: c.modelId,
    })
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    // Server data now carries catalogVehicleTypeId → the picker re-renders with
    // the "Araca Uygun Parçalar" button. Stay loading through the refresh.
    router.refresh()
  }

  async function resolve() {
    const vin = vehicle.vin ?? ""
    if (!isValidVin(vin)) return
    setLoading(true)
    setError("")
    setNotice("")
    setLocked(false)
    setCandidates([])
    try {
      const res = await fetch("/api/vin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin,
          hints: {
            engineDisplacement: vehicle.engineDisplacement || undefined,
            enginePower: vehicle.enginePower || undefined,
            fuelType: vehicle.fuelType || undefined,
            firstRegistrationDate: vehicle.firstRegistrationDate || undefined,
            modelYear: vehicle.modelYear ?? undefined,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.code === "feature_locked") setLocked(true)
        else setError(data.error || "Şase sorgulanamadı.")
        setLoading(false)
        return
      }
      const result = data as VinResolution
      if (result.status === "not_found") {
        setNotice("Şase numarası katalogda bulunamadı — Araç düzenle sayfasından marka/model seçin.")
        setLoading(false)
        return
      }
      const auto =
        result.status === "resolved" && result.autoSelected != null
          ? result.candidates.find((c) => c.vehicleTypeId === result.autoSelected)
          : undefined
      if (auto) {
        // Confident single match — link() keeps loading=true through the refresh.
        await link({ vehicleTypeId: auto.vehicleTypeId, brandId: auto.brandId, modelId: auto.modelId })
        return
      }
      if (result.candidates.length > 0) {
        setCandidates(result.candidates)
        setLoading(false)
        return
      }
      // Brand/model matched but the catalog carries no engine variant for that
      // model → nothing to link parts to (there is no manual variant picker).
      setNotice("Marka/model tanındı ama katalogda bu modele ait motor varyantı bulunamadı.")
      setLoading(false)
    } catch {
      setError("Şase sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Araç henüz kataloğa bağlı değil. Şase numarasından araca uygun parçaları getirmek için{" "}
        <span className="font-medium text-foreground">Şaseden bağla</span>&apos;ya basın
        {hasVin ? "." : " — önce Araç düzenle sayfasından geçerli bir şase numarası girin."}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" size="sm" variant="outline" disabled={!hasVin || loading} onClick={resolve} className="gap-1.5">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ScanLine className="size-3.5" />}
          Şaseden bağla
        </Button>
        <Link
          href={`/vehicles/${vehicle.id}/edit`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Araç bilgilerini düzenle
        </Link>
      </div>
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      {error && <p className="text-xs text-destructive-strong">{error}</p>}
      {locked && <VinLockedNotice />}
      {candidates.length > 0 && (
        <VinCandidateList
          candidates={candidates}
          selectedId={null}
          onSelect={(c) => link({ vehicleTypeId: c.vehicleTypeId, brandId: c.brandId, modelId: c.modelId })}
          onDismiss={() => setCandidates([])}
        />
      )}
    </div>
  )
}
