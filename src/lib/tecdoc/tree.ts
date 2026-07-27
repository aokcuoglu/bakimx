import type { CategoryLeaf, CategoryMatch, CategoryNode } from "./types"
import { normalizePartSearchTerm } from "@/lib/tr-search"

/**
 * Kategori ağacını yaprak listesine düzleştirir. Bir düğüm yaprak sayılır:
 * children boşsa. `path` yaprağa giden üst kategori adlarının " › " ile
 * birleşimi (yaprağın kendi adı hariç; kök yapraklarda "").
 */
export function flattenCategoryLeaves(nodes: CategoryNode[]): CategoryLeaf[] {
  const out: CategoryLeaf[] = []
  const walk = (list: CategoryNode[], trail: string[]) => {
    for (const node of list) {
      if (node.children.length === 0) {
        out.push({ id: node.id, name: node.name, path: trail.join(" › ") })
      } else {
        walk(node.children, [...trail, node.name])
      }
    }
  }
  walk(nodes, [])
  return out
}

/** Kategori aramasında varsayılan sonuç sınırı. */
export const CATEGORY_MATCH_LIMIT = 12

/**
 * Kategori ağacında ad/yol araması — parça seçicinin "KATEGORİLER" bölümünü besler.
 *
 * Ağacın TÜM düğümleri taranır (yalnız yapraklar değil): kullanıcı üst kategori
 * adını da yazabilir. Sorgu boşlukla terimlere ayrılır ve her terim düğümün kendi
 * adında VEYA yolunda geçmelidir (terim-AND) → "fren balata" hem "Fren tertibatı"
 * altındaki "Fren balatası"nı bulur. Karşılaştırma normalizePartSearchTerm ile
 * katlanmış metin üzerinde yapılır (Türkçe/aksan ve ayraç duyarsız) — parça
 * aramasıyla aynı anahtar üretimi.
 *
 * Sıralama: önce düğümün KENDİ adında eşleşenler (kullanıcının aradığı genelde
 * budur), sonra yalnız yol üzerinden eşleşenler; her grup kendi içinde tr'ye göre
 * alfabetik.
 */
export function searchCategoryTree(
  nodes: CategoryNode[],
  query: string,
  limit: number = CATEGORY_MATCH_LIMIT,
): CategoryMatch[] {
  const terms = query.trim().split(/\s+/).map(normalizePartSearchTerm).filter(Boolean)
  if (terms.length === 0) return []

  const direct: CategoryMatch[] = []
  const viaPath: CategoryMatch[] = []
  const walk = (list: CategoryNode[], trail: CategoryNode[]) => {
    for (const node of list) {
      const foldedName = normalizePartSearchTerm(node.name)
      const foldedPath = normalizePartSearchTerm(trail.map((n) => n.name).join(" "))
      if (terms.every((t) => foldedName.includes(t) || foldedPath.includes(t))) {
        const match: CategoryMatch = {
          node,
          ancestors: trail,
          path: trail.map((n) => n.name).join(" / "),
        }
        if (terms.some((t) => foldedName.includes(t))) direct.push(match)
        else viaPath.push(match)
      }
      if (node.children.length > 0) walk(node.children, [...trail, node])
    }
  }
  walk(nodes, [])

  const byName = (a: CategoryMatch, b: CategoryMatch) => a.node.name.localeCompare(b.node.name, "tr")
  direct.sort(byName)
  viaPath.sort(byName)
  return [...direct, ...viaPath].slice(0, Math.max(0, limit))
}

/**
 * Ağacı yalnızca `allowed` içindeki id'lere sahip yaprakları (ve onlara giden
 * dalları) koruyacak şekilde budar. Best-effort marka→kategori filtresi için.
 */
export function pruneTreeToCategoryIds(nodes: CategoryNode[], allowed: Set<number>): CategoryNode[] {
  const out: CategoryNode[] = []
  for (const node of nodes) {
    if (node.children.length === 0) {
      if (allowed.has(node.id)) out.push({ ...node, children: [] })
    } else {
      const children = pruneTreeToCategoryIds(node.children, allowed)
      if (children.length > 0) out.push({ ...node, children })
    }
  }
  return out
}
