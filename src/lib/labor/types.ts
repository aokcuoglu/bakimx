/** İstemci bileşenlerinin taşıdığı işçilik tanımı satırı (Prisma modelinin serileştirilmiş hâli). */
export type LaborCatalogRow = {
  id: string
  code: string | null
  name: string
  category: string | null
  /** Önerilen birim ücret, KURUŞ (money.ts kontratı). */
  defaultPriceKurus: number | null
  description: string | null
  isActive: boolean
}

export type LaborKPIs = {
  total: number
  active: number
  inactive: number
}
