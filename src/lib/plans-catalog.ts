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
    tier: "lite",
    name: "Lite",
    monthlyPrice: 499,
    yearlyPrice: 4990,
    monthlyLabel: "₺499/ay",
    yearlyLabel: "₺4.990/yıl",
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
    tier: "starter",
    name: "Başlangıç",
    monthlyPrice: 749,
    yearlyPrice: 7490,
    monthlyLabel: "₺749/ay",
    yearlyLabel: "₺7.490/yıl",
    tagline: "OCR, fotoğraf checklist & temel katalog",
    seats: PLAN_SEATS.starter,
    highlights: [
      "Mobil araç kabul + ruhsat OCR",
      "Fotoğraf checklist'i & hasar haritası",
      "Tahsilat, kasa & alacak yaşlandırma",
      "Araç pasaportu & servis geçmişi",
      "Parça kataloğu (1.000 kota/ay)",
      "Müşteriye link / WhatsApp paylaşımı",
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
      "Başlangıç'taki her şey",
      "5 kullanıcı dahil",
      "VIN'den araç tanıma & parça stok",
      "Randevu & çok kanallı bildirim",
      "Analitik & raporlama (5.000 kota/ay)",
    ],
  },
  {
    tier: "premium",
    name: "Premium",
    monthlyPrice: 2199,
    yearlyPrice: 21990,
    monthlyLabel: "₺2.199/ay",
    yearlyLabel: "₺21.990/yıl",
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

export function getPlanPackage(tier: PlanTier): PlanPackage | undefined {
  return PLAN_PACKAGES.find((p) => p.tier === tier)
}
