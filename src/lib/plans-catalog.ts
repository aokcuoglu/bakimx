import { PLAN_SEATS, type PlanTier, type SalePlanTier } from "@/lib/plan"

/**
 * Single source of truth for the in-app billing/upgrade UI. Tier ids match the
 * `PlanTier` enum, so `Workshop.planTier` maps directly to a catalog entry.
 * (The marketing landing page no longer renders a pricing table.)
 */
export interface PlanPackage {
  tier: SalePlanTier
  name: string
  /** Monthly price in TRY (VAT-included — the customer pays the displayed amount). */
  monthlyPrice: number
  /** Yearly price in TRY (VAT-included). 10× monthly = "2 ay bedava". */
  yearlyPrice: number
  monthlyLabel: string
  yearlyLabel: string
  /** Optional pre-campaign prices shown struck through. */
  listMonthlyLabel?: string
  listYearlyLabel?: string
  tagline: string
  /** Included login seats (mirrors PLAN_SEATS). Extra seats purchasable on top. */
  seats: number
  highlights: string[]
  popular?: boolean
}

export const PLAN_PACKAGES: PlanPackage[] = [
  {
    tier: "lite",
    name: "Lite",
    monthlyPrice: 0,
    yearlyPrice: 0,
    monthlyLabel: "₺0/ay",
    yearlyLabel: "₺0/yıl",
    listMonthlyLabel: "₺499/ay",
    listYearlyLabel: "₺4.990/yıl",
    tagline: "Temel araç kabul ve müşteri yönetimi",
    seats: PLAN_SEATS.lite,
    highlights: [
      "Sınırsız müşteri & araç kaydı",
      "Temel servis kaydı",
      "Temel fotoğraf yükleme",
      "Müşteriye link / WhatsApp paylaşımı",
    ],
  },
  {
    tier: "pro",
    name: "Profesyonel",
    monthlyPrice: 1799,
    yearlyPrice: 17990,
    monthlyLabel: "₺1.799/ay",
    yearlyLabel: "₺17.990/yıl",
    tagline: "Aktif 2–6 kişilik servisler için",
    popular: true,
    seats: PLAN_SEATS.pro,
    highlights: [
      "Mobil araç kabul + ruhsat OCR",
      "Fotoğraf checklist'i & hasar haritası",
      "Tahsilat, kasa & alacak yaşlandırma",
      "Araç pasaportu & servis geçmişi",
      "VIN'den araç tanıma & parça stok",
      "Randevu & çok kanallı bildirim",
      "Analitik & raporlama (5.000 kota/ay)",
    ],
  },
  {
    tier: "premium",
    name: "Premium",
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    monthlyLabel: "₺2.999/ay",
    yearlyLabel: "₺29.990/yıl",
    tagline: "e-Fatura ve çoklu şube",
    seats: PLAN_SEATS.premium,
    highlights: [
      "Profesyonel'deki her şey",
      "15 kullanıcı dahil",
      "e-Fatura / e-Arşiv entegrasyonu",
      "Çoklu şube & gelişmiş yetkilendirme (15.000 kota/ay)",
    ],
  },
]

const LEGACY_STARTER_PACKAGE = {
  tier: "starter" as const,
  name: "Başlangıç (eski)",
  monthlyPrice: 749,
  yearlyPrice: 7490,
  monthlyLabel: "₺749/ay",
  yearlyLabel: "₺7.490/yıl",
  tagline: "Artık yeni satışa kapalı eski paket",
  seats: PLAN_SEATS.starter,
  highlights: [],
}

export function getPlanPackage(tier: PlanTier): PlanPackage | typeof LEGACY_STARTER_PACKAGE | undefined {
  if (tier === "starter") return LEGACY_STARTER_PACKAGE
  return PLAN_PACKAGES.find((p) => p.tier === tier)
}
