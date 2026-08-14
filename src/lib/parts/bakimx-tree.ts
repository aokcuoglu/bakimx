import type { BakimxCategoryNode } from "@/lib/parts/bakimx-catalog"
import type { CategoryNode } from "@/lib/tecdoc/types"

/**
 * BakımX taksonomisini parça seçicinin kategori ağacına takılabilir hâle getirir
 * (BAK-35).
 *
 * SENTETİK ID: `CategoryNode.id` TecDoc düğüm kimliğidir; BakımX yapraklarının
 * öyle bir kimliği yok, kimlikleri `categoryKey` (string). Bu yüzden id yalnız
 * liste anahtarı olarak NEGATİF üretilir — TecDoc id'leri pozitif olduğu için
 * çakışma imkânsız, ve negatif bir id'nin yanlışlıkla TecDoc ucuna gitmesi
 * hâlinde sonuç sessizce boş döner, yanlış kategori açılmaz. Gerçek kimlik
 * `bakimxKey`'dir; arama ucuna giden de odur.
 */
export const BAKIMX_BRANCH_LABEL = "BakımX Ürünleri"

/** Dalın kökü. Sabit: geri tuşu ve breadcrumb bu id ile eşleşir. */
export const BAKIMX_BRANCH_ID = -1

export function isBakimxNode(node: CategoryNode): boolean {
  return node.source === "bakimx"
}

/**
 * Kategori listesinden tek bir "BakımX Ürünleri" dalı kurar. Ürünü olan yaprak
 * yoksa `null` döner — boş bir dal kullanıcıyı çıkmaz sokağa sokardı; kapı kapalı
 * atölyede de (kategori listesi boş gelir) dal hiç görünmemiş olur.
 */
export function buildBakimxCategoryBranch(categories: BakimxCategoryNode[]): CategoryNode | null {
  const leaves = categories
    .filter((c) => c.productCount > 0)
    .map(
      (c, index): CategoryNode => ({
        // -2, -3, … : kök -1'i kullandığı için ikiden başlar.
        id: -(index + 2),
        name: c.label,
        children: [],
        source: "bakimx",
        bakimxKey: c.key,
        productCount: c.productCount,
      }),
    )
  if (leaves.length === 0) return null
  return {
    id: BAKIMX_BRANCH_ID,
    name: BAKIMX_BRANCH_LABEL,
    children: leaves,
    source: "bakimx",
    productCount: leaves.reduce((sum, leaf) => sum + (leaf.productCount ?? 0), 0),
  }
}
