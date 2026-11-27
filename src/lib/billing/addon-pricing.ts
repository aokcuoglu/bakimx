import { CYCLE_DAYS, DAY_MS } from "@/lib/billing/proration"
import type { AddonFeature } from "@/lib/plan"
import { ADDON_CATALOG, getPlanPackage } from "@/lib/plans-catalog"
import type { BillingCycle } from "@prisma/client"

/** Uygulama içinden sipariş verilebilen ek özellikler (#829). */
export const ADDON_ORDER_KEYS = ["vinLookup", "ocrIntake", "multiBranch"] as const
export type AddonOrderKey = (typeof ADDON_ORDER_KEYS)[number]

export function isAddonOrderKey(v: unknown): v is AddonOrderKey {
  return typeof v === "string" && (ADDON_ORDER_KEYS as readonly string[]).includes(v)
}

export type AddonOrderItem = { key: AddonOrderKey; quantity: number }
export type AddonOrderLine = {
  key: AddonOrderKey
  name: string
  quantity: number
  /** Dönem içi orantılı birim tutar (kuruş). */
  unitAmountMinor: number
  /** unitAmountMinor × quantity (kuruş). */
  amountMinor: number
}

function catalogItem(key: AddonOrderKey) {
  const item = ADDON_CATALOG.find((a) => a.key === key)
  if (!item) throw new Error(`Bilinmeyen ek özellik: ${key}`)
  return item
}

/** Tam dönem fiyatı, kuruş. Fiyatı olmayan kalem için fırlatır. */
export function getAddonPriceMinor(key: AddonOrderKey, cycle: BillingCycle): number {
  const item = catalogItem(key)
  const lira = cycle === "yearly" ? item.yearlyPrice : item.monthlyPrice
  if (lira === null) throw new Error(`Ek özellik fiyatlanmadı: ${key}`)
  return Math.round(lira * 100)
}

/**
 * Mevcut dönemin kalan kısmı için orantılı tutar (kuruş). Kalan süre tam güne
 * YUKARI yuvarlanır (en az 1 gün), oran en fazla 1; tutar tam kuruşa
 * Math.ceil ile yuvarlanır (müşteri lehine değil, eksik tahsilat olmasın diye).
 */
export function computeAddonProrationMinor(i: {
  fullAmountMinor: number
  cycle: BillingCycle
  currentPeriodEnd: Date
  now: Date
}): number {
  const remainingMs = i.currentPeriodEnd.getTime() - i.now.getTime()
  if (remainingMs <= 0) throw new Error("Dönem sonu geçmiş; orantılı tutar hesaplanamaz.")
  const days = Math.max(1, Math.ceil(remainingMs / DAY_MS))
  const fraction = Math.min(1, days / CYCLE_DAYS[i.cycle])
  return Math.ceil(i.fullAmountMinor * fraction)
}

export function priceAddonOrder(i: {
  items: readonly AddonOrderItem[]
  cycle: BillingCycle
  currentPeriodEnd: Date
  now: Date
}): { lines: AddonOrderLine[]; amountMinor: number; fullCycleAmountMinor: number } {
  const lines: AddonOrderLine[] = []
  let amountMinor = 0
  let fullCycleAmountMinor = 0
  for (const item of i.items) {
    const full = getAddonPriceMinor(item.key, i.cycle)
    const unit = computeAddonProrationMinor({
      fullAmountMinor: full,
      cycle: i.cycle,
      currentPeriodEnd: i.currentPeriodEnd,
      now: i.now,
    })
    const amount = unit * item.quantity
    lines.push({
      key: item.key,
      name: catalogItem(item.key).name,
      quantity: item.quantity,
      unitAmountMinor: unit,
      amountMinor: amount,
    })
    amountMinor += amount
    fullCycleAmountMinor += full * item.quantity
  }
  return { lines, amountMinor, fullCycleAmountMinor }
}

/** Json sütunundan toleranslı okuma; bozuk girdiler düşer. */
export function parseAddonOrderLines(value: unknown): AddonOrderLine[] {
  if (!Array.isArray(value)) return []
  const out: AddonOrderLine[] = []
  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue
    const r = raw as Record<string, unknown>
    if (!isAddonOrderKey(r.key)) continue
    const { name, quantity, unitAmountMinor, amountMinor } = r
    if (typeof name !== "string") continue
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) continue
    if (typeof unitAmountMinor !== "number" || !Number.isFinite(unitAmountMinor)) continue
    if (typeof amountMinor !== "number" || !Number.isFinite(amountMinor)) continue
    out.push({ key: r.key, name, quantity, unitAmountMinor, amountMinor })
  }
  return out
}

export function addonFeaturesFor(keys: readonly AddonOrderKey[]): AddonFeature[] {
  const set = new Set<AddonFeature>()
  for (const key of keys) for (const f of catalogItem(key).features) set.add(f)
  return [...set]
}

export function describeBillingOrder(o: {
  type: string
  planTier: string
  billingCycle: "monthly" | "yearly"
  addonLines?: unknown
}): { title: string; cycleLabel: string; lines: { label: string; amountMinor: number | null }[] } {
  const cycleLabel = o.billingCycle === "yearly" ? "Yıllık" : "Aylık"
  if (o.type === "addon") {
    const addon = parseAddonOrderLines(o.addonLines)
    return {
      title: addon.length === 1 ? `Ek özellik: ${addon[0].name}` : "Ek özellik",
      cycleLabel,
      lines: addon.map((l) => ({
        label: l.quantity > 1 ? `${l.name} × ${l.quantity}` : l.name,
        amountMinor: l.amountMinor,
      })),
    }
  }
  const name = getPlanPackage(o.planTier as Parameters<typeof getPlanPackage>[0])?.name ?? o.planTier
  // "Servis Paketi" / "Paket + ek özellikler" zaten "paket" içerir — "Servis Paketi paketi" yazma.
  const title = /paket/i.test(name) ? name : `${name} paketi`
  return { title, cycleLabel, lines: [{ label: title, amountMinor: null }] }
}

/** Ek özellik ödemesi/aktivasyonu için paket dönemi açık mı (ücretli, bitmemiş)? */
export function isAddonPeriodOpen(
  account: { subscriptionStatus: string | null; currentPeriodEnd: Date | null } | null,
  now: Date,
): boolean {
  return (
    !!account &&
    account.subscriptionStatus === "active" &&
    !!account.currentPeriodEnd &&
    account.currentPeriodEnd.getTime() > now.getTime()
  )
}

/** Adet yalnız şube başına satılan kalemlerde birden fazla olabilir; hesap
 *  lisansı (`unit: "account"`) tek adettir. Birim katalogdan türetilir. */
export function isPerBranchAddon(key: AddonOrderKey): boolean {
  return catalogItem(key).unit === "extraBranch"
}

export type AddonOrderEligibilityInput = {
  isAccountWorkshop: boolean
  subscriptionStatus: string | null
  currentPeriodEnd: Date | null
  now: Date
  items: readonly { key: AddonOrderKey; owned: boolean }[]
  /** Engelleyen bekleyen sipariş: kendi atölyesi, aynı vergi no'lu başka atölye ya da yok. */
  pending: "own" | "tax" | null
}

export type AddonOrderEligibility =
  | { ok: true }
  | {
      ok: false
      reason: "not_account" | "no_open_period" | "not_purchasable" | "already_owned" | "pending_own" | "pending_tax"
      error: string
    }

/** Ek özellik siparişi verilebilir mi? Saf karar; DB okumaları çağıranda. */
export function evaluateAddonOrderEligibility(i: AddonOrderEligibilityInput): AddonOrderEligibility {
  if (!i.isAccountWorkshop) {
    return { ok: false, reason: "not_account", error: "Ek özellikler ana şubeden satın alınır." }
  }
  if (!isAddonPeriodOpen({ subscriptionStatus: i.subscriptionStatus, currentPeriodEnd: i.currentPeriodEnd }, i.now)) {
    return {
      ok: false,
      reason: "no_open_period",
      error: "Ek özellik almak için önce geçerli bir Servis Paketi dönemi gerekir.",
    }
  }
  for (const item of i.items) {
    const catalog = ADDON_CATALOG.find((a) => a.key === item.key)
    if (!catalog?.purchasable) {
      return { ok: false, reason: "not_purchasable", error: "Bu ek özellik şu an satın alınamaz." }
    }
    if (item.owned) {
      return { ok: false, reason: "already_owned", error: `${catalog.name} zaten hesabınızda açık.` }
    }
  }
  if (i.pending === "own") {
    return {
      ok: false,
      reason: "pending_own",
      error: "Zaten bekleyen bir talebiniz var. Ödemeniz onaylanana kadar yeni bir talep oluşturamazsınız.",
    }
  }
  if (i.pending === "tax") {
    return {
      ok: false,
      reason: "pending_tax",
      error: "Bu vergi/TC kimlik numarasına ait bekleyen bir talep zaten var.",
    }
  }
  return { ok: true }
}

const LIVE_TXN_STATUSES = new Set(["initiated", "callback_received", "completed"])

/**
 * Paket dönemi bitmiş ve canlı kart işlemi olmayan bekleyen ek özellik siparişi
 * artık tamamlanamaz (aktivasyon PERIOD_ENDED ile reddeder); yenilemeyi ve yeni
 * siparişi engellememeli. Canlı/tamamlanmış işlemi olan sipariş iptal EDİLMEZ:
 * para çekilmiş olabilir, ilgili akış çözmeli.
 */
export function isReleasableExpiredAddonOrder(
  order: { type: string; status: string },
  workshopPeriodEnd: Date | null,
  txns: ReadonlyArray<{ status: string }>,
  now: Date,
): boolean {
  if (order.type !== "addon" || order.status !== "pending_payment") return false
  if (workshopPeriodEnd && workshopPeriodEnd.getTime() > now.getTime()) return false
  return !txns.some((t) => LIVE_TXN_STATUSES.has(t.status))
}
