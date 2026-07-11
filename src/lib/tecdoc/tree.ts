import type { CategoryLeaf, CategoryNode } from "./types"

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
