export type QuantityLike = number | { toNumber(): number }

export const ORDER_ITEM_UNITS = ["adet", "litre"] as const
export type OrderItemUnit = (typeof ORDER_ITEM_UNITS)[number]

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
  if ((hasStockLink || unit !== "litre") && !Number.isInteger(quantity)) {
    return hasStockLink
      ? "Stok bağlı parçalarda miktar tam sayı olmalıdır"
      : "Ondalıklı miktar yalnız litre biriminde kullanılabilir"
  }
  return null
}

