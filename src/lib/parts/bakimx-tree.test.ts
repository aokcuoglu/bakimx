import { expect, test } from "bun:test"
import { BAKIMX_BRANCH_ID, BAKIMX_BRANCH_LABEL, buildBakimxCategoryBranch, isBakimxNode } from "./bakimx-tree"

const leaf = (key: string, label: string, productCount = 2) => ({ key, label, productCount })

test("dal kurulur: kök + yapraklar, gerçek kimlik categoryKey'dir", () => {
  const branch = buildBakimxCategoryBranch([leaf("aku", "Akü", 3), leaf("yag-filtresi", "Yağ filtresi")])
  expect(branch?.name).toBe(BAKIMX_BRANCH_LABEL)
  expect(branch?.id).toBe(BAKIMX_BRANCH_ID)
  expect(branch?.children.map((c) => c.bakimxKey)).toEqual(["aku", "yag-filtresi"])
  expect(branch?.children.map((c) => c.name)).toEqual(["Akü", "Yağ filtresi"])
})

/** TecDoc id'leri pozitif; sentetik id'ler negatif kalmalı ki çakışma imkânsız olsun. */
test("sentetik id'ler TecDoc düğüm id'leriyle çakışamaz", () => {
  const branch = buildBakimxCategoryBranch([leaf("aku", "Akü"), leaf("buji", "Buji"), leaf("lastik", "Lastik")])
  const ids = [branch!.id, ...branch!.children.map((c) => c.id)]
  expect(ids.every((id) => id < 0)).toBe(true)
  expect(new Set(ids).size).toBe(ids.length)
})

test("ürün sayısı kökte toplanır", () => {
  const branch = buildBakimxCategoryBranch([leaf("aku", "Akü", 3), leaf("buji", "Buji", 4)])
  expect(branch?.productCount).toBe(7)
})

/** Boş dal kullanıcıyı çıkmaz sokağa sokar — hiç render edilmemeli. */
test("ürünü olmayan kategori dala girmez", () => {
  const branch = buildBakimxCategoryBranch([leaf("aku", "Akü", 0), leaf("buji", "Buji", 2)])
  expect(branch?.children.map((c) => c.bakimxKey)).toEqual(["buji"])
})

test("hiç ürün yoksa (ör. kapı kapalı) dal kurulmaz", () => {
  expect(buildBakimxCategoryBranch([])).toBeNull()
  expect(buildBakimxCategoryBranch([leaf("aku", "Akü", 0)])).toBeNull()
})

test("kaynak ayrımı TecDoc düğümünü BakımX sanmaz", () => {
  const branch = buildBakimxCategoryBranch([leaf("aku", "Akü")])!
  expect(isBakimxNode(branch)).toBe(true)
  expect(isBakimxNode(branch.children[0])).toBe(true)
  expect(isBakimxNode({ id: 100, name: "Filtre", children: [] })).toBe(false)
})
