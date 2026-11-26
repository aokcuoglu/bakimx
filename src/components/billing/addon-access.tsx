"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import type { GatedFeature } from "@/lib/plan"
import { isTechnicianRestrictedRole } from "@/lib/technician-route-access"

/**
 * Oturumdaki atölyenin ve kullanıcının ek özellik erişimi (#853).
 *
 * `(app)/layout.tsx` sunucuda `getEnabledFeatures` ile hesaplar ve kabuk bu
 * bağlama koyar; böylece derin bileşenler (parça seçici, şaseden bağla) prop
 * zinciri kurmadan kilidi önceden çizer ve 403'e giden bir giriş render etmez.
 * Bu YALNIZ görünürlüktür: yetkiyi sunucudaki katalog ve şase uçları vermeye devam eder.
 *
 * Sağlayıcı yoksa (kabuk dışı render, testler) erişim açık varsayılır — kapıyı
 * sunucu zaten uygular, istemci "kapalı" varsaymaz.
 */
export type AddonAccess = {
  has: (feature: GatedFeature) => boolean
  /** Saha rolleri (usta/çırak/staff) satın alma kararı vermez: onlarda giriş yalnız gizlenir. */
  showUpsell: boolean
}

const OPEN_ACCESS: AddonAccess = { has: () => true, showUpsell: true }

const AddonAccessContext = createContext<AddonAccess>(OPEN_ACCESS)

export function resolveAddonAccess(enabledFeatures: readonly GatedFeature[], role: string | null | undefined): AddonAccess {
  return {
    has: (feature) => enabledFeatures.includes(feature),
    showUpsell: !isTechnicianRestrictedRole(role),
  }
}

export function AddonAccessProvider({
  enabledFeatures,
  role,
  children,
}: {
  enabledFeatures: readonly GatedFeature[]
  role: string | null | undefined
  children: ReactNode
}) {
  const value = useMemo(() => resolveAddonAccess(enabledFeatures, role), [enabledFeatures, role])
  return <AddonAccessContext.Provider value={value}>{children}</AddonAccessContext.Provider>
}

export function useAddonAccess(): AddonAccess {
  return useContext(AddonAccessContext)
}

/**
 * Araç katalog kimliğini TecDoc uçlarına vermeden önce kapıdan geçirir (#853):
 * parça kataloğu kapalıysa `null` döner, böylece arama/seçenek/eşleşme
 * kancaları (`vehicleTypeId == null` ise hiç istek atmaz) 403'e gitmez.
 */
export function tecdocTypeIdFor(access: AddonAccess, catalogVehicleTypeId: number | null | undefined): number | null {
  return access.has("partsCatalog") ? (catalogVehicleTypeId ?? null) : null
}

export function useTecdocTypeId(catalogVehicleTypeId: number | null | undefined): number | null {
  return tecdocTypeIdFor(useAddonAccess(), catalogVehicleTypeId)
}
