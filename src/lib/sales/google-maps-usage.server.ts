import "server-only"

import { prisma } from "@/lib/db"
import {
  GOOGLE_MAPS_SKUS,
  GOOGLE_MAPS_SKU_POLICIES,
  googleMapsUtcPeriod,
  type GoogleMapsSku,
} from "@/lib/sales/google-maps-quota"

type ReservationRow = {
  reserved_count: number
  blocked_count: number
  last_reserved_at: Date | null
  last_blocked_at: Date | null
}

export type GoogleMapsUsageReservation = {
  allowed: boolean
  sku: GoogleMapsSku
  period: string
  used: number
  limit: number
  remaining: number
}

export type GoogleMapsUsageSnapshotRow = GoogleMapsUsageReservation & {
  label: string
  freeMonthlyCap: number
  cloudDailyLimit: number
  blocked: number
  lastReservedAt: Date | null
  lastBlockedAt: Date | null
}

export type GoogleMapsUsageSnapshot = {
  period: string
  rows: GoogleMapsUsageSnapshotRow[]
}

/**
 * Billable Google çağrısından ÖNCE atomik olarak bir aylık kullanım hakkı ayırır.
 * `WHERE reserved_count < limit` aynı SKU'ya eşzamanlı gelen ECS task'larının
 * toplamda limiti aşmasını önler. DB hatası özellikle yakalanmaz: çağıran route
 * 503 döndürür ve istemci Google'a gitmez (maliyet kapısı fail-closed'dur).
 */
export async function reserveGoogleMapsUsage(
  sku: GoogleMapsSku,
  now: Date = new Date(),
): Promise<GoogleMapsUsageReservation> {
  const period = googleMapsUtcPeriod(now)
  const limit = GOOGLE_MAPS_SKU_POLICIES[sku].hardMonthlyLimit
  const rows = await prisma.$queryRaw<ReservationRow[]>`
    INSERT INTO "google_maps_usage_counters" (
      "period", "sku", "reserved_count", "blocked_count",
      "last_reserved_at", "last_blocked_at", "created_at", "updated_at"
    )
    VALUES (${period}, ${sku}, 1, 0, now(), NULL, now(), now())
    ON CONFLICT ("period", "sku") DO UPDATE SET
      "reserved_count" = "google_maps_usage_counters"."reserved_count" + 1,
      "last_reserved_at" = now(),
      "updated_at" = now()
    WHERE "google_maps_usage_counters"."reserved_count" < ${limit}
    RETURNING "reserved_count", "blocked_count", "last_reserved_at", "last_blocked_at"
  `

  const reserved = rows[0]
  if (reserved) {
    const used = Number(reserved.reserved_count)
    return { allowed: true, sku, period, used, limit, remaining: Math.max(0, limit - used) }
  }

  await prisma.$executeRaw`
    UPDATE "google_maps_usage_counters"
    SET
      "blocked_count" = "blocked_count" + 1,
      "last_blocked_at" = now(),
      "updated_at" = now()
    WHERE "period" = ${period} AND "sku" = ${sku}
  `

  return { allowed: false, sku, period, used: limit, limit, remaining: 0 }
}

export async function getGoogleMapsUsageSnapshot(now: Date = new Date()): Promise<GoogleMapsUsageSnapshot> {
  const period = googleMapsUtcPeriod(now)
  const counters = await prisma.googleMapsUsageCounter.findMany({
    where: { period },
    select: {
      sku: true,
      reservedCount: true,
      blockedCount: true,
      lastReservedAt: true,
      lastBlockedAt: true,
    },
  })
  const bySku = new Map(counters.map((counter) => [counter.sku, counter]))

  return {
    period,
    rows: GOOGLE_MAPS_SKUS.map((sku) => {
      const policy = GOOGLE_MAPS_SKU_POLICIES[sku]
      const counter = bySku.get(sku)
      const used = counter?.reservedCount ?? 0
      return {
        allowed: used < policy.hardMonthlyLimit,
        sku,
        period,
        label: policy.label,
        used,
        limit: policy.hardMonthlyLimit,
        remaining: Math.max(0, policy.hardMonthlyLimit - used),
        freeMonthlyCap: policy.freeMonthlyCap,
        cloudDailyLimit: policy.cloudDailyLimit,
        blocked: counter?.blockedCount ?? 0,
        lastReservedAt: counter?.lastReservedAt ?? null,
        lastBlockedAt: counter?.lastBlockedAt ?? null,
      }
    }),
  }
}

