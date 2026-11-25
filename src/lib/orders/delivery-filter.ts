import type { OrderStatus } from "@prisma/client"
import { istanbulDayBounds } from "@/lib/istanbul-time"
import { IN_SERVICE_ORDER_STATUSES } from "@/lib/orders/status-filter"

/**
 * İş emri listesindeki teslim tarihi filtresi (`?delivery=`).
 *
 * Genel Bakış'taki "Bugün teslim" ve "Geciken teslim" kartları sayılarını da
 * buradan alır; kart ile tıklayınca açılan liste bu yüzden aynı sayıyı gösterir.
 *
 *   ""        → filtre yok
 *   "today"   → tahmini teslimi bugün olan, hâlâ açık (teslim/iptal edilmemiş) emirler
 *   "overdue" → tahmini teslimi bugünden önce kalmış, hâlâ açık emirler
 *
 * "Bugün" Türkiye günüdür (Europe/Istanbul 00:00–24:00), sunucunun saat
 * diliminden bağımsız — Genel Bakış'taki diğer günlük sayımlarla aynı (#874).
 * Tanınmayan değer sessizce filtresiz hâle düşer.
 */

export const DELIVERY_TODAY = "today"
export const DELIVERY_OVERDUE = "overdue"

export type DeliveryFilterWhere =
  | Record<string, never>
  | {
      status: { in: OrderStatus[] }
      estimatedDeliveryAt: { gte: Date; lt: Date } | { lt: Date }
    }

export type ResolvedDeliveryFilter = {
  /** Normalize edilmiş değer — form/select'e geri verilecek olan. */
  value: string
  /** Prisma `where` parçası; filtre yoksa boş nesne. */
  where: DeliveryFilterWhere
}

export function resolveDeliveryFilter(
  raw: string | null | undefined,
  now: Date = new Date()
): ResolvedDeliveryFilter {
  const value = (raw || "").trim()
  const { start: today, end: tomorrow } = istanbulDayBounds(now)

  if (value === DELIVERY_TODAY) {
    return {
      value,
      where: {
        status: { in: IN_SERVICE_ORDER_STATUSES },
        estimatedDeliveryAt: { gte: today, lt: tomorrow },
      },
    }
  }

  if (value === DELIVERY_OVERDUE) {
    return {
      value,
      where: {
        status: { in: IN_SERVICE_ORDER_STATUSES },
        estimatedDeliveryAt: { lt: today },
      },
    }
  }

  return { value: "", where: {} }
}
