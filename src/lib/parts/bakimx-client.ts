"use client"

import { useEffect, useRef, useState } from "react"
import type { BakimxCategoryNode, BakimxProductSummary } from "@/lib/parts/bakimx-catalog"

/**
 * `/api/catalog/bakimx/*` uçlarının İSTEMCİ tarafı (BAK-35).
 *
 * KAPI DAVRANIŞI — bu dosyanın asıl işi: `bakimxCatalog` kapalı bir atölyede uçlar
 * **403 + `feature_locked`** döner. Bu bir HATA DEĞİLDİR, ürünün o atölyede yok
 * olmasıdır: çağıran taraf hata göstermez, BakımX bölümünü/dalını hiç render
 * etmez ve TecDoc + stok akışı hiç bozulmadan çalışmaya devam eder. Kapalı kapı
 * süreç boyunca hatırlanır ({@link gateLocked}) — aksi hâlde her tuş vuruşunda
 * 403 alacak bir istek daha atılırdı.
 *
 * Ağ/sunucu hatası da aynı şekilde SESSİZ boş listeye düşer, ama hatırlanmaz:
 * geçici bir hatanın kataloğu oturum boyunca kapatmaması için.
 */

export type BakimxFetchResult<T> =
  | { status: "ok"; data: T }
  | { status: "locked" }
  | { status: "error" }

/** Kapı bu oturumda 403 döndü mü? Modül düzeyinde — her bileşen aynı cevabı paylaşır. */
let gateLocked = false

/** Kapının kapalı olduğu ÖĞRENİLDİ mi? (Öğrenilmeden bölüm gizlenmez, boş kalır.) */
export function isBakimxGateLocked(): boolean {
  return gateLocked
}

/** Yalnız test içindir — modül düzeyindeki kapı belleğini sıfırlar. */
export function resetBakimxGateCache(): void {
  gateLocked = false
}

async function getJson<T>(url: string, key: string): Promise<BakimxFetchResult<T>> {
  if (gateLocked) return { status: "locked" }
  try {
    const res = await fetch(url)
    if (res.status === 403) {
      gateLocked = true
      return { status: "locked" }
    }
    if (!res.ok) return { status: "error" }
    const body = (await res.json()) as Record<string, unknown>
    const data = body?.[key]
    return Array.isArray(data) ? { status: "ok", data: data as T } : { status: "error" }
  } catch {
    return { status: "error" }
  }
}

export interface BakimxProductQuery {
  q?: string | null
  categoryKey?: string | null
  brandId?: string | null
  limit?: number | null
  /** Seçili aracın tipi — araca bağlı (`vehicle_linked`) ürünleri açar (BAK-46). */
  vehicleTypeId?: number | null
}

export function bakimxSearchUrl(query: BakimxProductQuery): string {
  const qs = new URLSearchParams()
  if (query.q) qs.set("q", query.q)
  if (query.categoryKey) qs.set("categoryKey", query.categoryKey)
  if (query.brandId) qs.set("brandId", query.brandId)
  if (query.limit != null) qs.set("limit", String(query.limit))
  if (query.vehicleTypeId != null) qs.set("vehicleTypeId", String(query.vehicleTypeId))
  return `/api/catalog/bakimx/search?${qs.toString()}`
}

export function fetchBakimxProducts(
  query: BakimxProductQuery,
): Promise<BakimxFetchResult<BakimxProductSummary[]>> {
  return getJson<BakimxProductSummary[]>(bakimxSearchUrl(query), "products")
}

/** Taksonomi arama ile AYNI aracı görmeli — aksi hâlde dolu görünen dal boş açılır. */
export function bakimxCategoriesUrl(vehicleTypeId?: number | null): string {
  const qs = new URLSearchParams()
  if (vehicleTypeId != null) qs.set("vehicleTypeId", String(vehicleTypeId))
  const query = qs.toString()
  return query ? `/api/catalog/bakimx/categories?${query}` : "/api/catalog/bakimx/categories"
}

export function fetchBakimxCategories(
  vehicleTypeId?: number | null,
): Promise<BakimxFetchResult<BakimxCategoryNode[]>> {
  return getJson<BakimxCategoryNode[]>(bakimxCategoriesUrl(vehicleTypeId), "categories")
}

export interface BakimxMatchResult {
  matches: Record<string, BakimxProductSummary>
}

export async function fetchBakimxMatches(
  articleNumbers: string[],
  vehicleTypeId?: number | null,
): Promise<BakimxFetchResult<Record<string, BakimxProductSummary>>> {
  if (gateLocked) return { status: "locked" }
  if (articleNumbers.length === 0) return { status: "ok", data: {} }

  try {
    const res = await fetch("/api/catalog/bakimx/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleNumbers, vehicleTypeId: vehicleTypeId ?? undefined }),
    })
    if (res.status === 403) {
      gateLocked = true
      return { status: "locked" }
    }
    if (!res.ok) return { status: "error" }
    const body = (await res.json()) as Record<string, unknown>
    const data = body?.matches
    return typeof data === "object" && data !== null
      ? { status: "ok", data: data as Record<string, BakimxProductSummary> }
      : { status: "error" }
  } catch {
    return { status: "error" }
  }
}

/** TecDoc kategorisine bağlı BakımX ürünlerini fetch et (BAK-45). */
export async function fetchBakimxProductsByTecdocCategory(
  categoryId: number,
  vehicleTypeId?: number | null,
): Promise<BakimxFetchResult<BakimxProductSummary[]>> {
  const qs = vehicleTypeId != null ? `?vehicleTypeId=${vehicleTypeId}` : ""
  return getJson<BakimxProductSummary[]>(
    `/api/parts/by-tecdoc-category/${categoryId}${qs}`,
    "products",
  )
}

/**
 * Sipariş TALEBİ oluşturur (BAK-60) — `POST /api/catalog/bakimx/orders`.
 *
 * Gövdede FİYAT YOKTUR ve olmamalıdır: tutarı sunucu atölyenin iskontosuyla
 * kendisi çözer. Buraya bir fiyat alanı eklemek sunucuda hiçbir şeyi değiştirmez
 * ama "fiyat istemciden gelmez" sözleşmesini okuyan bir sonraki kişiyi yanıltır.
 *
 * Okuma yollarının aksine kapı KAPALI olduğunda hata SESSİZ DEĞİLDİR: kullanıcı
 * bir düğmeye bastı, sonucu görmeli. Bu yüzden `gateLocked` belleği de burada
 * kullanılmaz — dönen mesaj olduğu gibi yüzeye çıkar.
 */
export async function createBakimxOrder(input: {
  items: { bakimxProductId: string; quantity: number }[]
  note?: string
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/catalog/bakimx/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    const body = (await res.json().catch(() => null)) as
      | { order?: { id?: string }; error?: string }
      | null
    if (!res.ok || !body?.order?.id) {
      return { ok: false, error: body?.error || "Sipariş oluşturulamadı." }
    }
    return { ok: true, orderId: body.order.id }
  } catch {
    return { ok: false, error: "Sipariş gönderilemedi. Bağlantınızı kontrol edin." }
  }
}

/** Satır içi arama ile aynı eşik: 2 karakterden kısa sorgu sunucuya gitmez. */
export const BAKIMX_MIN_SEARCH_LEN = 2
/** Açılır listede BakımX'e ayrılan yer — TecDoc satırlarını aşağı itmesin. */
export const BAKIMX_SUGGESTION_LIMIT = 8

/**
 * Katalog taksonomisi (parça seçicinin "BakımX Ürünleri" dalı). `enabled` false
 * iken hiç istek atılmaz — modal kapalıyken ağ trafiği olmasın.
 *
 * `locked`: kapı kapalı ya da uç okunamadı → dal hiç render EDİLMEMELİ.
 */
export function useBakimxCategories(
  enabled: boolean,
  vehicleTypeId?: number | null,
): {
  categories: BakimxCategoryNode[]
  locked: boolean
} {
  const [categories, setCategories] = useState<BakimxCategoryNode[]>([])
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let active = true
    void fetchBakimxCategories(vehicleTypeId).then((result) => {
      if (!active) return
      setCategories(result.status === "ok" ? result.data : [])
      setLocked(result.status !== "ok")
    })
    return () => {
      active = false
    }
  }, [enabled, vehicleTypeId])

  return { categories, locked }
}

/**
 * Ürün araması — satır içi otomatik tamamlama ve seçicinin arama bölümü ortak
 * kullanır. `q` 2 karakterden kısaysa (ve kategori süzgeci de yoksa) istek
 * atılmaz; sorgu 300 ms geciktirilir (TecDoc aramasıyla aynı kalıp).
 */
export function useBakimxProductSearch(input: {
  enabled: boolean
  q?: string | null
  categoryKey?: string | null
  limit?: number | null
  vehicleTypeId?: number | null
}): { products: BakimxProductSummary[]; locked: boolean; searching: boolean } {
  const { enabled, categoryKey = null, limit = null, vehicleTypeId = null } = input
  const q = (input.q ?? "").trim()
  const [products, setProducts] = useState<BakimxProductSummary[]>([])
  const [locked, setLocked] = useState(false)
  const [searching, setSearching] = useState(false)
  // Etkin olmayan/eşik altı sorguda temizliği effect'te değil render'da yapmamak
  // için son yayınlanan sorguyu takip ediyoruz (React Compiler render'da setState
  // yasaklıyor).
  const lastQueryRef = useRef<string | null>(null)

  const hasScope = q.length >= BAKIMX_MIN_SEARCH_LEN || !!categoryKey
  const requestKey = enabled && hasScope
    ? `${q}|${categoryKey ?? ""}|${limit ?? ""}|${vehicleTypeId ?? ""}`
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
      void fetchBakimxProducts({ q, categoryKey, limit, vehicleTypeId }).then((result) => {
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
    // q/categoryKey/limit değerleri requestKey içinde kodlu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  return { products, locked, searching }
}
