import type { OrderStatus } from "@prisma/client"
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
 * "Bugün" sunucu saatine göre gün başıdır — Genel Bakış'taki diğer günlük
 * sayımlarla aynı. Tanınmayan değer sessizce filtresiz hâle düşer.
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

export function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function resolveDeliveryFilter(
  raw: string | null | undefined,
  now: Date = new Date()
): ResolvedDeliveryFilter {
  const value = (raw || "").trim()
  const today = startOfLocalDay(now)

  if (value === DELIVERY_TODAY) {
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
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
