/** Tahsilat listesi sayfa boyutu (#936). */
export const COLLECTION_PAGE_SIZE = 25

export type CollectionPage = {
  page: number
  pageCount: number
  offset: number
  /** Ekrandaki ilk/son kaydın 1 tabanlı sırası; kayıt yoksa 0. */
  from: number
  to: number
}

/** `?page=` ham girdisini (1 tabanlı) güvenli bir tam sayıya çevirir. */
export function parsePageParam(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/**
 * Sayfa/offset hesabı. İstenen sayfa son sayfayı aşarsa son sayfaya kırpılır
 * (filtre daraldığında boş sayfa görünmesin). `total` süzülmüş TÜM kümenin
 * sayısıdır, sayfadan bağımsızdır.
 */
export function computeCollectionPage(
  requestedPage: number,
  total: number,
  pageSize: number = COLLECTION_PAGE_SIZE
): CollectionPage {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  const offset = (page - 1) * pageSize
  return {
    page,
    pageCount,
    offset,
    from: total === 0 ? 0 : offset + 1,
    to: Math.min(offset + pageSize, total),
  }
}
