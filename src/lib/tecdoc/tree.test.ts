import { describe, expect, it } from "bun:test"
import { flattenCategoryLeaves, pruneTreeToCategoryIds, searchCategoryTree } from "./tree"
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

describe("searchCategoryTree", () => {
  it("ara düğümleri de döner (yalnız yapraklar değil)", () => {
    // Sıra tr alfabetik: "Filtre" < "Hava filtresi" < "Yağ filtresi".
    expect(searchCategoryTree(tree, "filtre").map((c) => [c.node.id, c.path])).toEqual([
      [1, ""],
      [11, "Filtre"],
      [12, "Filtre"],
    ])
  })

  it("eşleşen düğümün atalarını taşır (breadcrumb yeniden kurulabilsin)", () => {
    const [match] = searchCategoryTree(tree, "hava filtresi")
    expect(match.node.id).toBe(11)
    expect(match.ancestors.map((a) => a.id)).toEqual([1])
    // Ağaçtaki düğümün kendisi döner → children ile drill-down yapılabilir.
    expect(match.node.children).toEqual([])
  })

  it("terimleri AND'ler; terim ad VEYA yolda eşleşebilir", () => {
    // "balata" yalnız 21'in adında, "fren" ise hem adında hem yolunda geçer.
    expect(searchCategoryTree(tree, "fren balata").map((c) => c.node.id)).toEqual([21])
  })

  it("tüm terimler eşleşmeyen düğüm elenir", () => {
    // "filtre yag": 12 kendi adında ikisini de karşılar; 11 "yag"ı hiçbir yerde
    // bulamaz → listede yok.
    expect(searchCategoryTree(tree, "filtre yag").map((c) => c.node.id)).toEqual([12])
  })

  it("yalnız yol üzerinden eşleşenler kendi adında eşleşenlerden SONRA gelir", () => {
    const local: CategoryNode[] = [
      { id: 1, name: "Filtre", children: [{ id: 13, name: "Kabin", children: [] }] },
      { id: 4, name: "Ana filtre", children: [] },
    ]
    // "Kabin" yalnız yolu ("Filtre") üzerinden eşleşir → adında eşleşenlerin sonuna.
    expect(searchCategoryTree(local, "filtre").map((c) => c.node.id)).toEqual([4, 1, 13])
  })

  it("Türkçe/aksan ve ayraç duyarsız eşleşir", () => {
    expect(searchCategoryTree(tree, "YAG FILTRESI").map((c) => c.node.id)).toEqual([12])
    expect(searchCategoryTree(tree, "havafiltresi").map((c) => c.node.id)).toEqual([11])
  })

  it("boş sorguda boş dizi", () => {
    expect(searchCategoryTree(tree, "   ")).toEqual([])
  })

  it("limit uygulanır", () => {
    expect(searchCategoryTree(tree, "filtre", 2)).toHaveLength(2)
    expect(searchCategoryTree(tree, "filtre", 0)).toEqual([])
  })

  it("eşleşme yoksa boş dizi", () => {
    expect(searchCategoryTree(tree, "turbo")).toEqual([])
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
