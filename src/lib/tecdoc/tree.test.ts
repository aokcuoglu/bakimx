import { describe, expect, it } from "bun:test"
import { flattenCategoryLeaves, pruneTreeToCategoryIds } from "./tree"
import type { CategoryNode } from "./types"

const tree: CategoryNode[] = [
  {
    id: 1, name: "Filtre", children: [
      { id: 11, name: "Hava filtresi", children: [] },
      { id: 12, name: "Yağ filtresi", children: [] },
    ],
  },
  { id: 2, name: "Fren", children: [
      { id: 21, name: "Fren balatası", children: [] },
    ],
  },
  { id: 3, name: "Yağ (yaprak-kök)", children: [] },
]

describe("flattenCategoryLeaves", () => {
  it("yalnız yaprakları döner, üst yolu path'e yazar", () => {
    const leaves = flattenCategoryLeaves(tree)
    expect(leaves).toEqual([
      { id: 11, name: "Hava filtresi", path: "Filtre" },
      { id: 12, name: "Yağ filtresi", path: "Filtre" },
      { id: 21, name: "Fren balatası", path: "Fren" },
      { id: 3, name: "Yağ (yaprak-kök)", path: "" },
    ])
  })
  it("boş ağaçta boş dizi", () => {
    expect(flattenCategoryLeaves([])).toEqual([])
  })
})

describe("pruneTreeToCategoryIds", () => {
  it("yalnız izinli yaprak içeren dalları korur", () => {
    const pruned = pruneTreeToCategoryIds(tree, new Set([11, 21]))
    expect(pruned).toEqual([
      { id: 1, name: "Filtre", children: [{ id: 11, name: "Hava filtresi", children: [] }] },
      { id: 2, name: "Fren", children: [{ id: 21, name: "Fren balatası", children: [] }] },
    ])
  })
  it("izinli yaprak yoksa boş dizi", () => {
    expect(pruneTreeToCategoryIds(tree, new Set([999]))).toEqual([])
  })
  it("yaprak-kök izinliyse korunur", () => {
    expect(pruneTreeToCategoryIds(tree, new Set([3]))).toEqual([
      { id: 3, name: "Yağ (yaprak-kök)", children: [] },
    ])
  })
  it("boş ağaçta boş dizi", () => {
    expect(pruneTreeToCategoryIds([], new Set([1]))).toEqual([])
  })
})
