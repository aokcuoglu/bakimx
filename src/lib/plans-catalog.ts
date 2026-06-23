import { PLAN_SEATS, type PlanTier } from "@/lib/plan"

/**
 * Single source of truth for the in-app billing/upgrade UI. Tier ids match the
 * `PlanTier` enum, so `Workshop.planTier` maps directly to a catalog entry.
 * (The marketing landing page no longer renders a pricing table.)
 */
export interface PlanPackage {
  tier: PlanTier
  name: string
  /** Monthly price in TRY (VAT-included — the customer pays the displayed amount). */
  monthlyPrice: number
  /** Yearly price in TRY (VAT-included). 10× monthly = "2 ay bedava". */
  yearlyPrice: number
  monthlyLabel: string
  yearlyLabel: string
  tagline: string
  /** Included login seats (mirrors PLAN_SEATS). Extra seats purchasable on top. */
  seats: number
  highlights: string[]
  popular?: boolean
}

export const PLAN_PACKAGES: PlanPackage[] = [
  {
    tier: "starter",
    name: "Başlangıç",
    monthlyPrice: 749,
    yearlyPrice: 7490,
    monthlyLabel: "₺749/ay",
    yearlyLabel: "₺7.490/yıl",
    tagline: "Tek kullanıcı, temel araç kabul akışı",
    seats: PLAN_SEATS.starter,
    highlights: [
      "Mobil araç kabul + ruhsat OCR",
      "Fotoğraf checklist'i & hasar haritası",
      "Müşteriye link / WhatsApp paylaşımı",
      "Sınırsız müşteri & araç kaydı",
    ],
  },
  {
    tier: "pro",
    name: "Profesyonel",
    monthlyPrice: 1299,
    yearlyPrice: 12990,
    monthlyLabel: "₺1.299/ay",
    yearlyLabel: "₺12.990/yıl",
    tagline: "Aktif 2–6 kişilik servisler için",
    popular: true,
    seats: PLAN_SEATS.pro,
    highlights: [
      "Tahsilat, kasa & alacak yaşlandırma",
      "Parça/stok, tedarikçi, randevu",
      "Çok kanallı bildirim & analitik",
      "Araç pasaportu & servis geçmişi",
    ],
  },
  {
    tier: "premium",
    name: "Premium",
    monthlyPrice: 2199,
    yearlyPrice: 21990,
    monthlyLabel: "₺2.199/ay",
    yearlyLabel: "₺21.990/yıl",
    tagline: "e-Fatura, AI ve çoklu şube",
    seats: PLAN_SEATS.premium,
    highlights: [
      "Profesyonel'deki her şey",
      "e-Fatura / e-Arşiv entegrasyonu",
      "AI servis danışmanı",
      "Çoklu şube & gelişmiş yetkilendirme",
    ],
  },
]

export function getPlanPackage(tier: PlanTier): PlanPackage | undefined {
  return PLAN_PACKAGES.find((p) => p.tier === tier)
}
