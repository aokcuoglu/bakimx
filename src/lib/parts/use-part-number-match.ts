"use client"

import { useEffect, useState } from "react"
import { fetchBakimxProducts } from "@/lib/parts/bakimx-client"
import type { StockPartLite } from "@/lib/parts/suggestions"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import {
  findPartNumberMatches,
  PURCHASE_MATCH_MIN_LEN,
  type PurchaseMatch,
} from "@/lib/parts/purchase-match"

/**
 * Yazılan parça numarasını üç kaynakta birden arar ve BİREBİR eşleşenleri döner
 * (BAK-84). Kaynaklar, "Yeni Parça Talebi" kutusundaki arama ile AYNI uçlar:
 * araç şase bazlı TecDoc kataloğu, BakımX ürün kataloğu ve atölye stok kartları.
 *
 * Uçların hepsi best-effort: hata/kapalı kapı sessizce boş listeye düşer — dış
 * alım kaydı her koşulda elle tamamlanabilmeli, uyarı bir kolaylıktır, kapı değil
 * (bkz. bakimx-client.ts kapı davranışı).
 */
export function usePartNumberMatch(input: {
  /** Kullanıcının yazdığı/OCR'den seçtiği parça numarası. */
  partNo: string
  /** Aracın TecDoc tipi; null ise araç kataloğu hiç sorgulanmaz. */
  vehicleTypeId: number | null
  /** Katalog bağı zaten kurulmuşsa (parça listeden seçildi) sorgu atılmaz. */
  enabled: boolean
}): { matches: PurchaseMatch[]; searching: boolean } {
  const { vehicleTypeId, enabled } = input
  const partNo = input.partNo.trim()
  const [matches, setMatches] = useState<PurchaseMatch[]>([])
  const [searching, setSearching] = useState(false)

  const active = enabled && partNo.length >= PURCHASE_MATCH_MIN_LEN
  // Etkin olmayan girdide effect'in temizleme dalı çalışsın diye anahtar null olur.
  const requestKey = active ? `${partNo}|${vehicleTypeId ?? ""}` : null

  useEffect(() => {
    if (requestKey == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches([])
      setSearching(false)
      return
    }
    let alive = true
    // Arama kutularıyla aynı 300 ms debounce — her tuş vuruşunda üç uç çağrılmasın.
    const timer = setTimeout(async () => {
      setSearching(true)
      const [articles, stockParts, bakimxProducts] = await Promise.all([
        fetchArticles(vehicleTypeId, partNo),
        fetchStockParts(partNo),
        fetchBakimxProducts({ q: partNo, limit: 10, vehicleTypeId }).then((r) =>
          r.status === "ok" ? r.data : ([] as BakimxProductSummary[]),
        ),
      ])
      if (!alive) return
      setMatches(findPartNumberMatches(partNo, { articles, bakimxProducts, stockParts }))
      setSearching(false)
    }, 300)
    return () => {
      alive = false
      clearTimeout(timer)
    }
    // partNo/vehicleTypeId değerleri requestKey içinde kodlu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  return { matches, searching }
}

async function fetchArticles(vehicleTypeId: number | null, q: string): Promise<ArticleSearchResult[]> {
  if (vehicleTypeId == null) return []
  try {
    const res = await fetch(
      `/api/tecdoc/articles/search?vehicleId=${vehicleTypeId}&q=${encodeURIComponent(q)}`,
    )
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.articles) ? data.articles : []
  } catch {
    return []
  }
}

async function fetchStockParts(q: string): Promise<StockPartLite[]> {
  try {
    const res = await fetch(`/api/parts/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data.parts) ? data.parts : []
  } catch {
    return []
  }
}
