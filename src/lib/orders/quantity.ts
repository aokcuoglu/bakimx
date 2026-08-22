export type QuantityLike = number | { toNumber(): number }

export const ORDER_ITEM_UNITS = [
  "adet",
  "litre",
  "mililitre",
  "kilogram",
  "gram",
  "metre",
  "santimetre",
  "takim",
  "set",
  "cift",
  "paket",
  "kutu",
  "sise",
  "tup",
  "bidon",
  "rulo",
] as const
export type OrderItemUnit = (typeof ORDER_ITEM_UNITS)[number]

export const ORDER_ITEM_UNIT_LABELS: Record<OrderItemUnit, string> = {
  adet: "Adet",
  litre: "Litre",
  mililitre: "Mililitre",
  kilogram: "Kilogram",
  gram: "Gram",
  metre: "Metre",
  santimetre: "Santimetre",
  takim: "Takım",
  set: "Set",
  cift: "Çift",
  paket: "Paket",
  kutu: "Kutu",
  sise: "Şişe",
  tup: "Tüp",
  bidon: "Bidon",
  rulo: "Rulo",
}

export const DIVISIBLE_ORDER_ITEM_UNITS = [
  "litre",
  "mililitre",
  "kilogram",
  "gram",
  "metre",
  "santimetre",
] as const satisfies readonly OrderItemUnit[]

export function isDivisibleOrderItemUnit(unit: string | null | undefined): boolean {
  return DIVISIBLE_ORDER_ITEM_UNITS.some((candidate) => candidate === unit)
}

export function quantityToNumber(value: QuantityLike): number {
  return typeof value === "number" ? value : value.toNumber()
}

export function isValidOrderItemQuantity(quantity: number): boolean {
  return Number.isFinite(quantity) && quantity > 0 && quantity <= 999 && Math.round(quantity * 1000) === quantity * 1000
}

export function validateQuantityForUnit(
  quantity: number,
  unit: string | null | undefined,
  hasStockLink = false,
): string | null {
  if (!isValidOrderItemQuantity(quantity)) return "Miktar 0'dan büyük, en fazla 999 ve en çok 3 ondalık basamaklı olmalıdır"
  if ((hasStockLink || !isDivisibleOrderItemUnit(unit)) && !Number.isInteger(quantity)) {
    return hasStockLink
      ? "Stok bağlı parçalarda miktar tam sayı olmalıdır"
      : "Bu birimde miktar tam sayı olmalıdır"
  }
  return null
}
