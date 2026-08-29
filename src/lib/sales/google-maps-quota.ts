export const GOOGLE_MAPS_SKUS = [
  "dynamic_maps",
  "autocomplete_requests",
  "place_details_essentials",
  "nearby_search_pro",
] as const

export type GoogleMapsSku = (typeof GOOGLE_MAPS_SKUS)[number]

export type GoogleMapsSkuPolicy = {
  label: string
  freeMonthlyCap: number
  hardMonthlyLimit: number
  cloudDailyLimit: number
}

/**
 * Google Maps Platform'ın Ağustos 2026 fiyat tablosundaki aylık ücretsiz SKU
 * sınırları. Uygulama sınırı her SKU'da bunun %80'idir. Google, quota ve
 * billing sayaçları arasında fark olabileceğini belirttiği için kalan %20
 * bilinçli güvenlik payıdır; ortam değişkeniyle yükseltilemez.
 */
export const GOOGLE_MAPS_SKU_POLICIES: Record<GoogleMapsSku, GoogleMapsSkuPolicy> = {
  dynamic_maps: {
    label: "Dynamic Maps",
    freeMonthlyCap: 10_000,
    hardMonthlyLimit: 8_000,
    cloudDailyLimit: 250,
  },
  autocomplete_requests: {
    label: "Autocomplete Requests",
    freeMonthlyCap: 10_000,
    hardMonthlyLimit: 8_000,
    cloudDailyLimit: 250,
  },
  place_details_essentials: {
    label: "Place Details Essentials",
    freeMonthlyCap: 10_000,
    hardMonthlyLimit: 8_000,
    cloudDailyLimit: 250,
  },
  nearby_search_pro: {
    label: "Nearby Search Pro",
    freeMonthlyCap: 5_000,
    hardMonthlyLimit: 4_000,
    cloudDailyLimit: 100,
  },
}

export function googleMapsUtcPeriod(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

