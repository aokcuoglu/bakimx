import type { OrderStatus } from "@prisma/client"
import { isOrderLocked } from "@/lib/status-transitions"

/** `NEXT_STATUSES[status]` girdisi (order-management-panel); başlık aksiyonlarıyla aynı kaynak. */
export type NextStatusAction = { key: string; label: string; primary?: boolean }

/**
 * Sıradaki adımı kapatan (engel) ya da ileride kapatacak (not) açık iş (#913).
 * Metinler başlığın altındaki eski uyarı şeritlerinden birebir taşındı; şeritler
 * kalktı, açıklama ve çıkış yolu Durum kartında ve telefon özet kartında.
 */
export type OrderStepIssue = {
  kind: "undecided" | "unpriced"
  /** "2 parça talebi karar bekliyor" */
  text: string
  /** İlk iki ad + "+N"; ad yoksa null. */
  preview: string | null
  /** Ne yapılması gerektiği. */
  hint: string
  /** Kalemler bölümüne giden bağlantının metni. */
  linkLabel: string
}

export type OrderNextStep = {
  /** Başlıktaki birincil düğmenin işi: "Başla", "Teslime Hazır", "Teslim Et"… */
  label: string
  /** O adımı (başlıktaki düğmeyi) bugün kapatan engeller; teslim adımında ikisi birden olabilir. */
  blockers: OrderStepIssue[]
  /** Sıradaki adımı kapatmayan ama ileride kapatacak açık işler. */
  notes: OrderStepIssue[]
}

const PREVIEW_NAMES = 2

/** İlk iki ad, fazlası "+N": "Fren balatası, Yağ filtresi, +3". */
export function previewNames(names: readonly string[]): string | null {
  if (names.length === 0) return null
  const head = names.slice(0, PREVIEW_NAMES).join(", ")
  return names.length > PREVIEW_NAMES ? `${head}, +${names.length - PREVIEW_NAMES}` : head
}

function undecidedIssue(names: readonly string[]): OrderStepIssue {
  return {
    kind: "undecided",
    text: `${names.length} parça talebi karar bekliyor`,
    preview: previewNames(names),
    hint:
      "Her talebi ya kaleme ekleyin ya da iptal edin; karar verilmeden araç kabulü teslime " +
      "hazırlanamaz ve teslim edilemez.",
    linkLabel: "Kalemlerde karar ver",
  }
}

function unpricedIssue(names: readonly string[]): OrderStepIssue {
  return {
    kind: "unpriced",
    text: `${names.length} kalemin fiyatı girilmemiş`,
    preview: previewNames(names),
    hint: "Teslim için tüm kalemlere fiyat girin (0 TL girilebilir).",
    linkLabel: "Kalemlerde tamamla",
  }
}

/**
 * Araç kabulünün sıradaki adımı ve onu kapatan engeller (#911, #913). Telefonda
 * özet kartında, masaüstünde raydaki Durum kartında görünür.
 *
 * Adım, başlıktaki birincil aksiyonla aynı girdiden (`NEXT_STATUSES`) okunur;
 * buraya ayrı bir durum makinesi yazılmaz. Lib → bileşen bağımlılığı olmasın diye
 * liste çağıran yerden gelir.
 *
 * Engel yalnız sıradaki adımın düğmesini gerçekten kapatıyorsa engeldir —
 * başlıktaki `disabled` kuralıyla aynı: karar bekleyen parça talebi "Teslime
 * Hazır"ı ve teslimi, fiyatsız kalem teslimi kapatır. Teslim adımında ikisi
 * birlikte listelenir (biri çözülünce öteki sürpriz olmasın). Sıradaki adım başka
 * bir şeyse (ör. "Başla", "Devam Et") karar bekleyen talep nötr bir not olur;
 * fiyatsız kalem teslimden önce beklenen bir eksik olduğu için hiç yazılmaz.
 *
 * Teslim edilmiş ve iptal emirde sıradaki adım yoktur → null.
 */
export function orderNextStep({
  status,
  actions,
  unpricedNames,
  undecidedNames,
}: {
  status: string
  actions: readonly NextStatusAction[]
  /** Fiyatı girilmemiş kalemlerin adları (`findUnpricedItems`). */
  unpricedNames: readonly string[]
  /** Karar bekleyen parça taleplerinin adları (`findUndecidedPartsRequests`). */
  undecidedNames: readonly string[]
}): OrderNextStep | null {
  if (isOrderLocked(status as OrderStatus)) return null
  const primary = actions.find((action) => action.primary)
  if (!primary) return null
  // Başlık teslim düğmesini "Teslim Et (OTP)" diye yazar; durum satırında yöntem yazılmaz.
  const label = primary.key === "delivered" ? "Teslim Et" : primary.label

  const blockers: OrderStepIssue[] = []
  const notes: OrderStepIssue[] = []
  const partsGate = primary.key === "ready_for_delivery" || primary.key === "delivered"
  if (undecidedNames.length > 0) (partsGate ? blockers : notes).push(undecidedIssue(undecidedNames))
  if (primary.key === "delivered" && unpricedNames.length > 0) blockers.push(unpricedIssue(unpricedNames))
  return { label, blockers, notes }
}
