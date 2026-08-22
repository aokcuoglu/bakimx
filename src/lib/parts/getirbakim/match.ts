import type { GetirbakimProduct } from "./types"
import { normalizePartNo } from "@/lib/parts/suggestions"

/**
 * TecDoc makalesi ile GetirBakım ticari satırını parça numarası / OEM üzerinden
 * eşleştirir. Aynı parça iki kaynaktan geldiğinde GetirBakım satırı TecDoc
 * makalesinin ALTINA yuva kurulsun diye (vitrin deseni); üst satır hâlâ TecDoc
 * katalog kalemi, yuva GetirBakım kalemi ekler.
 */

export interface TecdocMatchArticle {
  tecdocArticleId: number
  articleNo: string
  matchedOems?: string[]
}

function articleKeys(article: TecdocMatchArticle): Set<string> {
  const keys = [article.articleNo, ...(article.matchedOems ?? [])]
    .map(normalizePartNo)
    .filter(Boolean)
  return new Set(keys)
}

function productKeys(product: GetirbakimProduct): Set<string> {
  const keys = [
    product.partNo,
    product.manufacturerPartNumber?.value,
    ...product.oemNumbers,
    ...product.references.map((reference) => reference.value),
  ]
    .map(normalizePartNo)
    .filter(Boolean)
  return new Set(keys)
}

export function getirbakimMatchesArticle(
  product: GetirbakimProduct,
  article: TecdocMatchArticle,
): boolean {
  const articleSet = articleKeys(article)
  if (articleSet.size === 0) return false
  for (const key of productKeys(product)) {
    if (articleSet.has(key)) return true
  }
  return false
}

export function nestGetirbakimUnderArticles<T extends TecdocMatchArticle>(
  articles: T[],
  products: GetirbakimProduct[],
): {
  nested: Record<number, GetirbakimProduct[]>
  standalone: GetirbakimProduct[]
} {
  const nested: Record<number, GetirbakimProduct[]> = {}
  const claimed = new Set<string>()

  for (const article of articles) {
    const matches = products.filter(
      (product) => !claimed.has(product.id) && getirbakimMatchesArticle(product, article),
    )
    if (matches.length === 0) continue
    nested[article.tecdocArticleId] = matches
    for (const product of matches) claimed.add(product.id)
  }

  return {
    nested,
    standalone: products.filter((product) => !claimed.has(product.id)),
  }
}
