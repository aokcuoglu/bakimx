import type { GetirbakimFitmentLevel, GetirbakimProduct } from "./types"

/**
 * GetirBakım satırının araca uyum seviyesi ve "uyanlar önce" sıralaması (#755).
 *
 * Seviye ayrıştırıcıda (`parseGetirbakimProduct`) belirlenir; burada yalnız
 * okunur. Alan, sunucumuzdan gelen bir yanıtta yoksa (eski önbellek, test
 * verisi) `exactFitment`'tan türetilir — `CONFIRMED` dışında hiçbir şey
 * "tam uyumlu" sayılmaz.
 */
export function getirbakimFitLevel(product: GetirbakimProduct): GetirbakimFitmentLevel {
  if (product.exactFitment.status === "CONFIRMED") return "guaranteed"
  return product.fitmentLevel === "likely" && product.exactFitment.requestedVehicleTypeId != null
    ? "likely"
    : "unknown"
}

const FIT_RANK: Record<GetirbakimFitmentLevel, number> = { guaranteed: 0, likely: 1, unknown: 2 }

/**
 * Uyanlar önce: tam uyumlu → muhtemelen uyumlu → diğerleri. KARARLI sıralama —
 * her seviye içinde GetirBakım'ın arama sırası (alaka) korunur. Hiçbir satır
 * ELENMEZ: araca uymayan parça da aranabilir kalmalı.
 */
export function sortGetirbakimByFit<T extends GetirbakimProduct>(products: T[]): T[] {
  return products
    .map((product, index) => ({ product, index, rank: FIT_RANK[getirbakimFitLevel(product)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ product }) => product)
}

/** "Yalnız bu araca uyanlar" süzgecinde kalır mı? Tam ve muhtemel uyum kalır. */
export function getirbakimMatchesVehicle(product: GetirbakimProduct): boolean {
  return getirbakimFitLevel(product) !== "unknown"
}

/**
 * İstemcide gösterilen araç ile yanıtın istendiği araç farklıysa (araç değişti,
 * eski yanıt geldi) uyum iddiası düşürülür — başka aracın rozeti bu araca
 * yapışmasın.
 */
export function dropForeignFitment(
  product: GetirbakimProduct,
  vehicleTypeId: number | null,
): GetirbakimProduct {
  if (product.exactFitment.requestedVehicleTypeId === vehicleTypeId) return product
  if (product.exactFitment.status !== "CONFIRMED" && product.fitmentLevel === "unknown") return product
  return {
    ...product,
    exactFitment: { requestedVehicleTypeId: null, status: "NOT_REQUESTED", matchedVehicleTypeIds: [] },
    fitmentLevel: "unknown",
  }
}
