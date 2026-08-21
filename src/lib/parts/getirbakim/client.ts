"use client"

import { useEffect, useRef, useState } from "react"
import {
  GETIRBAKIM_MIN_SEARCH_LEN,
  type GetirbakimProduct,
  type GetirbakimSearchInput,
} from "./types"

/**
 * `/api/catalog/getirbakim/*` ucunun İSTEMCİ tarafı (BAK-183).
 *
 * Kapı davranışı `bakimx-client.ts` ile AYNI ve aynı gerekçeyle: `getirbakimCatalog`
 * kapalı bir atölyede uç **403 + `feature_locked`** döner; bu bir HATA DEĞİL,
 * ürünün o atölyede yok olmasıdır. Çağıran hata göstermez, GetirBakım bölümünü
 * hiç render etmez, TecDoc + BakımX katalog akışı bozulmadan çalışmaya devam
 * eder. Kapalı kapı süreç boyunca hatırlanır — aksi hâlde her tuş vuruşunda
 * 403 alacak bir istek daha atılırdı.
 *
 * Ağ/sunucu hatası da sessizce boş listeye düşer ama HATIRLANMAZ: geçici bir
 * hatanın kaynağı oturum boyunca kapatmaması için.
 */

export type GetirbakimFetchResult =
  | { status: "ok"; data: GetirbakimProduct[] }
  | { status: "locked" }
  | { status: "error" }

let gateLocked = false

export function isGetirbakimGateLocked(): boolean {
  return gateLocked
}

/** Yalnız test içindir — modül düzeyindeki kapı belleğini sıfırlar. */
export function resetGetirbakimGateCache(): void {
  gateLocked = false
}

export function getirbakimSearchUrl(query: GetirbakimSearchInput): string {
  const qs = new URLSearchParams()
  if (query.oem) qs.set("oem", query.oem)
  else if (query.q) qs.set("q", query.q)
  if (query.limit != null) qs.set("limit", String(query.limit))
  if (query.vehicleTypeId != null) qs.set("vehicleTypeId", String(query.vehicleTypeId))
  return `/api/catalog/getirbakim/search?${qs.toString()}`
}

export async function fetchGetirbakimProducts(
  query: GetirbakimSearchInput,
): Promise<GetirbakimFetchResult> {
  if (gateLocked) return { status: "locked" }
  try {
    const res = await fetch(getirbakimSearchUrl(query))
    if (res.status === 403) {
      gateLocked = true
      return { status: "locked" }
    }
    if (!res.ok) return { status: "error" }
    const body = (await res.json()) as Record<string, unknown>
    const data = body?.products
    return Array.isArray(data)
      ? { status: "ok", data: data as GetirbakimProduct[] }
      : { status: "error" }
  } catch {
    return { status: "error" }
  }
}

/**
 * GetirBakım araması — TecDoc/BakımX aramasıyla AYNI kalıp: eşik altı sorgu
 * sunucuya gitmez, sorgu 300 ms geciktirilir.
 *
 * `locked`: kapı kapalı ya da uç okunamadı → bölüm hiç render EDİLMEMELİ.
 */
export function useGetirbakimSearch(input: {
  enabled: boolean
  q?: string | null
  limit?: number | null
  vehicleTypeId?: number | null
}): { products: GetirbakimProduct[]; locked: boolean; searching: boolean } {
  const { enabled, limit = null, vehicleTypeId = null } = input
  const q = (input.q ?? "").trim()
  const [products, setProducts] = useState<GetirbakimProduct[]>([])
  const [locked, setLocked] = useState(false)
  const [searching, setSearching] = useState(false)
  // Etkin olmayan/eşik altı sorguda temizliği render'da değil effect'te yapmak
  // için son yayınlanan sorguyu takip ediyoruz (React Compiler render'da
  // setState yasaklıyor) — bakimx-client.ts ile aynı gerekçe.
  const lastQueryRef = useRef<string | null>(null)

  const requestKey = enabled && q.length >= GETIRBAKIM_MIN_SEARCH_LEN
    ? `${q}|${limit ?? ""}|${vehicleTypeId ?? ""}`
    : null

  useEffect(() => {
    if (requestKey == null) {
      if (lastQueryRef.current !== null) {
        lastQueryRef.current = null
        setProducts([])
        setSearching(false)
      }
      return
    }
    lastQueryRef.current = requestKey
    let active = true
    const timer = setTimeout(() => {
      // Spinner debounce'tan SONRA açılır: her tuş vuruşunda yanıp sönmesin.
      setSearching(true)
      void fetchGetirbakimProducts({ q, limit, vehicleTypeId }).then((result) => {
        if (!active) return
        setProducts(result.status === "ok" ? result.data : [])
        setLocked(result.status !== "ok")
        setSearching(false)
      })
    }, 300)
    return () => {
      active = false
      clearTimeout(timer)
    }
    // q/limit değerleri requestKey içinde kodlu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const safeProducts = products.map((product) =>
    product.exactFitment.status === "CONFIRMED" &&
    product.exactFitment.requestedVehicleTypeId !== vehicleTypeId
      ? { ...product, exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED" as const, matchedVehicleTypeIds: [] } }
      : product,
  )
  return { products: safeProducts, locked, searching }
}
