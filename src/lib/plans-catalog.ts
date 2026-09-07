import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import {
  PLAN_SEATS,
  SALE_PLAN_TIERS,
  VIN_LOOKUP_QUOTA,
  hasFeature,
  type GatedFeature,
  type PlanTier,
  type SalePlanTier,
} from "@/lib/plan"
import {
  COMPRESS_TARGET_BYTES,
  MAX_ACTIVE_PHOTOS_PER_INTAKE,
  MAX_BATCH_PHOTOS,
  MAX_FILE_SIZE_BYTES,
  MAX_RAW_INPUT_BYTES,
} from "@/lib/photos/limits"

/** Shared sales metadata. Numeric entitlements live in their domain contracts. */
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
  /** Included login seats, derived from PLAN_SEATS. */
  seats: number
  highlights: string[]
  popular?: boolean
}

type PlanPackageDefinition = Omit<
  PlanPackage,
  "monthlyLabel" | "yearlyLabel" | "listMonthlyLabel" | "listYearlyLabel"
> & {
  listMonthlyPrice?: number
  listYearlyPrice?: number
}

function priceLabel(price: number, cycle: "ay" | "yıl"): string {
  return `₺${price.toLocaleString("tr-TR")}/${cycle}`
}

function definePlanPackage(definition: PlanPackageDefinition): PlanPackage {
  const { listMonthlyPrice, listYearlyPrice, ...plan } = definition
  return {
    ...plan,
    monthlyLabel: priceLabel(plan.monthlyPrice, "ay"),
    yearlyLabel: priceLabel(plan.yearlyPrice, "yıl"),
    ...(listMonthlyPrice == null ? {} : { listMonthlyLabel: priceLabel(listMonthlyPrice, "ay") }),
    ...(listYearlyPrice == null ? {} : { listYearlyLabel: priceLabel(listYearlyPrice, "yıl") }),
  }
}

export const PLAN_PACKAGES: PlanPackage[] = [
  definePlanPackage({
    tier: "lite",
    name: "Lite",
    monthlyPrice: 0,
    yearlyPrice: 0,
    listMonthlyPrice: 499,
    listYearlyPrice: 4_990,
    tagline: "Temel kayıtlarını dijitale taşıyan servisler için",
    seats: PLAN_SEATS.lite,
    highlights: [
      "Sınırsız müşteri, araç ve iş emri",
      "Manuel araç kabul",
      "Müşteri paylaşım bağlantısı ve WhatsApp",
    ],
  }),
  definePlanPackage({
    tier: "pro",
    name: "Profesyonel",
    monthlyPrice: 1799,
    yearlyPrice: 17990,
    tagline: "Aktif servis operasyonunu uçtan uca yöneten ekipler için",
    popular: true,
    seats: PLAN_SEATS.pro,
    highlights: [
      FEATURE_CATALOG.ocrIntake.name,
      FEATURE_CATALOG.photoChecklist.name,
      FEATURE_CATALOG.cashbox.name,
      FEATURE_CATALOG.partsInventory.name,
      FEATURE_CATALOG.appointments.name,
      FEATURE_CATALOG.analytics.name,
    ],
  }),
  definePlanPackage({
    tier: "premium",
    name: "Premium",
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    tagline: "Daha büyük ekipler ve yüksek katalog sorgu hacmi için",
    seats: PLAN_SEATS.premium,
    highlights: [
      "Profesyonel paketteki tüm canlı özellikler",
      `${PLAN_SEATS.premium} kullanıcı dahil`,
      `${VIN_LOOKUP_QUOTA.premium.toLocaleString("tr-TR")} şase ve canlı katalog sorgusu/ay`,
      "Premium yol haritasına erişim",
    ],
  }),
]

export type PlanComparisonValue = {
  state: "included" | "unavailable" | "coming-soon" | "text"
  label: string
}

export type PlanComparisonRow = {
  key: string
  label: string
  description?: string
  values: Record<SalePlanTier, PlanComparisonValue>
}

export type PlanComparisonCategory = {
  key: "limits" | "core" | "intake" | "operations" | "roadmap"
  label: string
  rows: readonly PlanComparisonRow[]
}

const unavailable = (): PlanComparisonValue => ({ state: "unavailable", label: "Yok" })
const included = (label = "Dahil"): PlanComparisonValue => ({ state: "included", label })
const text = (label: string): PlanComparisonValue => ({ state: "text", label })

function featureRow(
  feature: GatedFeature,
  options: { label?: string; description?: string; comingSoon?: boolean } = {},
): PlanComparisonRow {
  return {
    key: feature,
    label: options.label ?? FEATURE_CATALOG[feature].name,
    description: options.description,
    values: Object.fromEntries(
      SALE_PLAN_TIERS.map((tier) => {
        if (!hasFeature(tier, feature)) return [tier, unavailable()]
        return [
          tier,
          options.comingSoon
            ? ({ state: "coming-soon", label: "Yakında" } satisfies PlanComparisonValue)
            : included(),
        ]
      }),
    ) as Record<SalePlanTier, PlanComparisonValue>,
  }
}

export const PLAN_PHOTO_POLICY: Record<
  SalePlanTier,
  { enabled: boolean; maxActivePerWorkOrder: number }
> = Object.fromEntries(
  SALE_PLAN_TIERS.map((tier) => [
    tier,
    {
      enabled: hasFeature(tier, "photoChecklist"),
      maxActivePerWorkOrder: hasFeature(tier, "photoChecklist")
        ? MAX_ACTIVE_PHOTOS_PER_INTAKE
        : 0,
    },
  ]),
) as Record<SalePlanTier, { enabled: boolean; maxActivePerWorkOrder: number }>

function mb(bytes: number): number {
  return bytes / (1024 * 1024)
}

export const PHOTO_UPLOAD_POLICY = {
  rawSelectionMb: mb(MAX_RAW_INPUT_BYTES),
  compressionTargetMb: mb(COMPRESS_TARGET_BYTES),
  serverLimitMb: mb(MAX_FILE_SIZE_BYTES),
  maxPerSelection: MAX_BATCH_PHOTOS,
  maxActivePerWorkOrder: MAX_ACTIVE_PHOTOS_PER_INTAKE,
} as const

const coreRow = (key: string, label: string): PlanComparisonRow => ({
  key,
  label,
  values: { lite: included(), pro: included(), premium: included() },
})

export const PLAN_COMPARISON: readonly PlanComparisonCategory[] = [
  {
    key: "limits",
    label: "Kullanım limitleri",
    rows: [
      {
        key: "seats",
        label: "Dahil kullanıcı",
        values: Object.fromEntries(
          SALE_PLAN_TIERS.map((tier) => [tier, text(String(PLAN_SEATS[tier]))]),
        ) as Record<SalePlanTier, PlanComparisonValue>,
      },
      {
        key: "live-catalog-quota",
        label: "Şase + canlı katalog sorgusu",
        values: Object.fromEntries(
          SALE_PLAN_TIERS.map((tier) => {
            const quota = VIN_LOOKUP_QUOTA[tier]
            return [tier, quota > 0 ? text(`${quota.toLocaleString("tr-TR")}/ay`) : unavailable()]
          }),
        ) as Record<SalePlanTier, PlanComparisonValue>,
      },
      {
        key: "records",
        label: "Müşteri, araç ve iş emri",
        values: { lite: text("Sınırsız"), pro: text("Sınırsız"), premium: text("Sınırsız") },
      },
      {
        key: "work-order-photos",
        label: "İş emri fotoğrafı",
        description: "Aktif, silinmemiş fotoğraflar için iş emri başına limit.",
        values: Object.fromEntries(
          SALE_PLAN_TIERS.map((tier) => {
            const policy = PLAN_PHOTO_POLICY[tier]
            return [tier, policy.enabled ? text(`${policy.maxActivePerWorkOrder} aktif/iş emri`) : unavailable()]
          }),
        ) as Record<SalePlanTier, PlanComparisonValue>,
      },
    ],
  },
  {
    key: "core",
    label: "Temel kayıtlar",
    rows: [
      coreRow("manual-intake", "Manuel araç kabul"),
      coreRow("work-orders", "İş emri"),
      coreRow("customer-share", "Müşteri paylaşım bağlantısı"),
      coreRow("whatsapp", "WhatsApp paylaşımı"),
    ],
  },
  {
    key: "intake",
    label: "Araç kabul ve kanıt",
    rows: [
      featureRow("ocrIntake"),
      featureRow("photoChecklist"),
      featureRow("damageMap"),
      featureRow("vehiclePassport"),
    ],
  },
  {
    key: "operations",
    label: "Operasyon",
    rows: [
      featureRow("quotes"),
      featureRow("cashbox"),
      featureRow("partsInventory"),
      featureRow("procurement"),
      featureRow("appointments"),
      featureRow("automatedReminders"),
      featureRow("communications"),
      featureRow("analytics"),
      featureRow("reports"),
    ],
  },
  {
    key: "roadmap",
    label: "Premium yol haritası",
    rows: [
      featureRow("eInvoice", { label: "e-Fatura / e-Arşiv", comingSoon: true }),
      featureRow("multiBranch", { comingSoon: true }),
      featureRow("rbac", { comingSoon: true }),
    ],
  },
] as const

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
