"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { flattenCategoryLeaves } from "@/lib/tecdoc/tree"
import type { AttrOption } from "@/components/app/part-attribute-commit"
import type { CategoryLeaf, CategoryNode, PartBrandSummary } from "@/lib/tecdoc/types"

/**
 * Aracın marka listesi + kategori ağacı grid genelinde AYNI olduğu için, her
 * Marka/Kategori hücresinin kendi başına fetch atması yerine bu provider onları
 * araç başına TEK sefer çeker ve tüm hücrelere paylaştırır. Böylece bir iş emri
 * açılışında ~2N istek yerine 2 istek atılır — hem iç rate-limit (30/dk) delinmez
 * hem de soğuk araçta N eşzamanlı `/categories` yarışı (N gerçek RapidAPI çağrısı)
 * ortadan kalkar. Kotasız cache uçlarıdır ama tekrarlı olması gereksizdir.
 */
type AttrOptionsState = {
  brand: AttrOption[]
  category: AttrOption[]
  brandLoaded: boolean
  categoryLoaded: boolean
}

const EMPTY: AttrOptionsState = { brand: [], category: [], brandLoaded: true, categoryLoaded: true }

const PartAttrOptionsContext = createContext<AttrOptionsState>(EMPTY)

export function PartAttrOptionsProvider({
  vehicleTypeId,
  children,
}: {
  vehicleTypeId: number | null
  children: React.ReactNode
}) {
  const [state, setState] = useState<AttrOptionsState>(EMPTY)

  useEffect(() => {
    if (vehicleTypeId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(EMPTY)
      return
    }
    let active = true
    setState({ brand: [], category: [], brandLoaded: false, categoryLoaded: false })

    fetch(`/api/tecdoc/brands?vehicleId=${vehicleTypeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        const brands: PartBrandSummary[] = Array.isArray(data?.brands) ? data.brands : []
        setState((s) => ({ ...s, brand: brands.map((b) => ({ id: b.supplierId, label: b.name })), brandLoaded: true }))
      })
      .catch(() => { if (active) setState((s) => ({ ...s, brandLoaded: true })) })

    fetch(`/api/tecdoc/categories?vehicleId=${vehicleTypeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return
        const tree: CategoryNode[] = Array.isArray(data?.categories) ? data.categories : []
        const leaves: CategoryLeaf[] = flattenCategoryLeaves(tree)
        setState((s) => ({
          ...s,
          category: leaves.map((l) => ({ id: l.id, label: l.name, sub: l.path || undefined })),
          categoryLoaded: true,
        }))
      })
      .catch(() => { if (active) setState((s) => ({ ...s, categoryLoaded: true })) })

    return () => { active = false }
  }, [vehicleTypeId])

  return <PartAttrOptionsContext.Provider value={state}>{children}</PartAttrOptionsContext.Provider>
}

/** Bir hücrenin türüne göre paylaşılan seçenekleri + yükleme durumunu döndürür. */
export function usePartAttrOptions(kind: "brand" | "category"): { options: AttrOption[]; loaded: boolean } {
  const state = useContext(PartAttrOptionsContext)
  return kind === "brand"
    ? { options: state.brand, loaded: state.brandLoaded }
    : { options: state.category, loaded: state.categoryLoaded }
}
