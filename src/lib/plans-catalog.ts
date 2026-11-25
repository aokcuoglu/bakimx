import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import {
  PLAN_LABELS,
  PLAN_SEATS,
  SALE_PLAN_TIERS,
  hasFeature,
  type AddonFeature,
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
export interface PlanPackage<T extends PlanTier = PlanTier> {
  tier: T
  name: string
  /** Monthly price in TRY (VAT-included — the customer pays the displayed amount). */
  monthlyPrice: number
  /** Yearly price in TRY (VAT-included). 10× monthly = "2 ay bedava". */
  yearlyPrice: number
  monthlyLabel: string
  yearlyLabel: string
  tagline: string
  /** Included login seats, derived from PLAN_SEATS. */
  seats: number
  highlights: readonly string[]
}

/** A package offered for new purchases. */
export type SalePlanPackage = PlanPackage<SalePlanTier>

type PlanPackageDefinition<T extends PlanTier> = Omit<PlanPackage<T>, "monthlyLabel" | "yearlyLabel">

function priceLabel(price: number, cycle: "ay" | "yıl"): string {
  if (price === 0) return "0 TL/ay"
  return `₺${price.toLocaleString("tr-TR")}/${cycle}`
}

function definePlanPackage<T extends PlanTier>(definition: PlanPackageDefinition<T>): PlanPackage<T> {
  return {
    ...definition,
    monthlyLabel: priceLabel(definition.monthlyPrice, "ay"),
    yearlyLabel: priceLabel(definition.yearlyPrice, "yıl"),
  }
}

/**
 * Tek satış paketi (#782): ₺1.499/ay KDV dahil, yıllık 10 × aylık. Makbuz ve
 * TAMI satırı bu adı kullanır ("Servis Paketi · Aylık").
 */
export const SERVICE_PACKAGE: SalePlanPackage = definePlanPackage({
  tier: "pro",
  name: PLAN_LABELS.pro,
  monthlyPrice: 1499,
  yearlyPrice: 14990,
  tagline: "Servis yönetimi için gereken her şey tek pakette",
  seats: PLAN_SEATS.pro,
  highlights: [
    FEATURE_CATALOG.plateScan.name,
    FEATURE_CATALOG.photoChecklist.name,
    FEATURE_CATALOG.cashbox.name,
    FEATURE_CATALOG.partsInventory.name,
    FEATURE_CATALOG.appointments.name,
    FEATURE_CATALOG.analytics.name,
  ],
})

export const PLAN_PACKAGES: readonly SalePlanPackage[] = [SERVICE_PACKAGE]

/**
 * Satışa kapalı paketler. Mevcut satırlar (sipariş, makbuz, proration, yaşam
 * döngüsü e-postası) kırılmadan okunabilsin diye tutar ve ad burada kalır.
 * Yeni satış yalnız {@link PLAN_PACKAGES} üzerinden yapılır.
 */
export const LEGACY_PLAN_PACKAGES: readonly PlanPackage[] = [
  definePlanPackage({
    tier: "lite",
    name: PLAN_LABELS.lite,
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: "Artık yeni satışa kapalı eski paket",
    seats: PLAN_SEATS.lite,
    highlights: [],
  }),
  definePlanPackage({
    tier: "starter",
    name: PLAN_LABELS.starter,
    monthlyPrice: 749,
    yearlyPrice: 7490,
    tagline: "Artık yeni satışa kapalı eski paket",
    seats: PLAN_SEATS.starter,
    highlights: [],
  }),
  definePlanPackage({
    tier: "premium",
    name: PLAN_LABELS.premium,
    monthlyPrice: 2999,
    yearlyPrice: 29990,
    tagline: "Servis Paketi ve tüm ek özellikler",
    seats: PLAN_SEATS.premium,
    highlights: [],
  }),
]

export function getPlanPackage(tier: PlanTier): PlanPackage | undefined {
  return PLAN_PACKAGES.find((p) => p.tier === tier) ?? LEGACY_PLAN_PACKAGES.find((p) => p.tier === tier)
}

/**
 * Pakete dahil OLMAYAN, ileride uygulama içinden ayrıca satılacak yetenekler.
 * Fiyatları henüz belirlenmedi — bilinçli olarak fiyat alanı yok; kilitli
 * yüzeyler "yakında satın alınabilir / bizimle iletişime geçin" der.
 */
export type AddonCatalogItem = {
  key: AddonFeature | "aiAssistant"
  name: string
  description: string
  /** Bu ek özelliğin açtığı kapılar. AI danışmanının kodda kapısı yok. */
  features: readonly AddonFeature[]
}

export const ADDON_CATALOG: readonly AddonCatalogItem[] = [
  {
    key: "vinLookup",
    name: "Şaseden parça",
    description: "Şase numarasından aracı tanıyın, uyumlu parçaları katalogdan bulun.",
    features: ["vinLookup", "partsCatalog"],
  },
  {
    key: "aiAssistant",
    name: "AI danışmanı",
    description: "Arıza ve bakım kararlarında yapay zekâ destekli öneriler.",
    features: [],
  },
  {
    key: "ocrIntake",
    name: FEATURE_CATALOG.ocrIntake.name,
    description: "Ruhsat fotoğrafından müşteri ve araç alanlarını otomatik doldurun.",
    features: ["ocrIntake"],
  },
  {
    key: "eInvoice",
    name: FEATURE_CATALOG.eInvoice.name,
    description: "e-Fatura ve e-Arşiv işlemlerini BakımX içinde tamamlayın.",
    features: ["eInvoice"],
  },
  {
    key: "multiBranch",
    name: FEATURE_CATALOG.multiBranch.name,
    description: "Birden fazla şubeyi tek hesaptan yönetin.",
    features: ["multiBranch"],
  },
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
  key: "limits" | "core" | "intake" | "operations"
  label: string
  rows: readonly PlanComparisonRow[]
}

const unavailable = (): PlanComparisonValue => ({ state: "unavailable", label: "Yok" })
const included = (label = "Dahil"): PlanComparisonValue => ({ state: "included", label })
const text = (label: string): PlanComparisonValue => ({ state: "text", label })

function perSaleTier(value: (tier: SalePlanTier) => PlanComparisonValue): Record<SalePlanTier, PlanComparisonValue> {
  return Object.fromEntries(SALE_PLAN_TIERS.map((tier) => [tier, value(tier)])) as Record<
    SalePlanTier,
    PlanComparisonValue
  >
}

function featureRow(
  feature: Exclude<GatedFeature, AddonFeature>,
  options: { label?: string; description?: string } = {},
): PlanComparisonRow {
  return {
    key: feature,
    label: options.label ?? FEATURE_CATALOG[feature].name,
    description: options.description,
    values: perSaleTier((tier) => (hasFeature(tier, feature) ? included() : unavailable())),
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
  values: perSaleTier(() => included()),
})

/**
 * "Pakete dahil" tablosu. Yalnız paketteki yetenekler listelenir; ek
 * özellikler ayrı {@link ADDON_CATALOG} listesinde durur.
 */
export const PLAN_COMPARISON: readonly PlanComparisonCategory[] = [
  {
    key: "limits",
    label: "Kullanım limitleri",
    rows: [
      {
        key: "seats",
        label: "Dahil kullanıcı",
        values: perSaleTier((tier) => text(String(PLAN_SEATS[tier]))),
      },
      {
        key: "records",
        label: "Müşteri, araç ve araç kabulü",
        values: perSaleTier(() => text("Sınırsız")),
      },
      {
        key: "work-order-photos",
        label: "Araç kabul fotoğrafı",
        description: "Aktif, silinmemiş fotoğraflar için araç kabul başına limit.",
        values: perSaleTier((tier) => {
          const policy = PLAN_PHOTO_POLICY[tier]
          return policy.enabled ? text(`${policy.maxActivePerWorkOrder} aktif/araç kabulü`) : unavailable()
        }),
      },
    ],
  },
  {
    key: "core",
    label: "Temel kayıtlar",
    rows: [
      coreRow("manual-intake", "Manuel araç kabul"),
      coreRow("work-orders", "Araç kabulü"),
      coreRow("customer-share", "Müşteri paylaşım bağlantısı"),
      coreRow("whatsapp", "WhatsApp paylaşımı"),
    ],
  },
  {
    key: "intake",
    label: "Araç kabul ve kanıt",
    rows: [
      featureRow("plateScan"),
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
] as const
