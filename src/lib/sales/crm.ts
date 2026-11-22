import type { SalesActivityResult, SalesLeadStatus, SalesTaskType } from "@prisma/client"
import { normalizePhone } from "@/lib/format"

export function normalizeSalesEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? ""
  return normalized || null
}

export function normalizeSalesPhone(value: string): string | null {
  return normalizePhone(value) || null
}

export function leadStatusForActivityResult(result: SalesActivityResult | undefined): SalesLeadStatus | null {
  switch (result) {
    case "reached":
    case "follow_up_required":
      return "contacted"
    case "demo_scheduled":
      return "demo_scheduled"
    case "proposal_sent":
      return "proposal"
    case "won":
      return "won"
    case "lost":
      return "lost"
    case "no_answer":
    case undefined:
      return null
  }
}

export function taskTypeForActivityResult(result: SalesActivityResult | undefined): SalesTaskType {
  return result === "demo_scheduled" ? "online_demo" : "follow_up"
}

export function taskDurationForActivityResult(result: SalesActivityResult | undefined): number {
  return result === "demo_scheduled" ? 60 : 30
}

export function isSalesLeadAttributionFrozen(lead: {
  status: SalesLeadStatus
  attributionFrozenAt: Date | null
}): boolean {
  return lead.status === "won" || lead.attributionFrozenAt !== null
}

export type SalesTaskBucket = "overdue" | "today" | "upcoming"

export function salesTaskBucket(startsAt: Date, now: Date, tomorrow: Date): SalesTaskBucket {
  if (startsAt < now) return "overdue"
  if (startsAt < tomorrow) return "today"
  return "upcoming"
}

/**
 * Satış adayı / demo talebinin listelerdeki görünen adı. Ana sayfadaki
 * "Sizi arayalım" talepleri (#781) yalnız ad + telefonla gelir ve işletme adı
 * boştur; boş bağlantı metni adayı listeden açılamaz hâle getiriyordu.
 */
export function salesLeadDisplayName(lead: { businessName: string; contactName: string }): string {
  return lead.businessName.trim() || lead.contactName.trim() || "İsimsiz talep"
}
