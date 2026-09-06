import { ACQUISITION_SOURCE_LABELS } from "@/lib/acquisition-sources"

type JsonRecord = Record<string, unknown>

export interface AuditMetadataChange {
  key: string
  label: string
  before: string
  after: string
  changed: boolean
}

export interface AuditMetadataDetail {
  key: string
  label: string
  value: string
}

export interface ParsedAuditMetadata {
  changes: AuditMetadataChange[]
  details: AuditMetadataDetail[]
  raw: string | null
}

const FIELD_LABELS: Record<string, string> = {
  acquisitionSource: "Edinim kaynağı",
  acquisitionAdvisorId: "Satış temsilcisi",
  featureKey: "Özellik",
  enabled: "Etkin",
  expiresAt: "Geçerlilik sonu",
  readOnly: "Salt okunur",
  targetUserId: "Hedef kullanıcı",
  targetEmail: "Hedef e-posta",
  delivered: "Teslim edildi",
  extraSeats: "Ek kullanıcı sayısı",
  status: "Durum",
  workshopId: "İş yeri",
  storageProvider: "Depolama sağlayıcısı",
  sizeBytes: "Dosya boyutu",
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function humanizeSegment(segment: string) {
  const mapped = FIELD_LABELS[segment]
  if (mapped) return mapped

  const spaced = segment
    .replace(/([a-zğüşöçı0-9])([A-ZĞÜŞÖÇİ])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()

  return spaced ? spaced.charAt(0).toLocaleUpperCase("tr-TR") + spaced.slice(1) : "Değer"
}

export function formatAuditFieldLabel(key: string) {
  return key.split(".").map(humanizeSegment).join(" · ")
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} KB`
  return `${(value / (1024 * 1024)).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`
}

export function formatAuditValue(value: unknown, key = ""): string {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Evet" : "Hayır"

  if (key.endsWith("acquisitionSource") && typeof value === "string") {
    return ACQUISITION_SOURCE_LABELS[value as keyof typeof ACQUISITION_SOURCE_LABELS] ?? value
  }

  if (key.endsWith("sizeBytes") && typeof value === "number") return formatBytes(value)

  if (key.endsWith("At") && typeof value === "string") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      })
    }
  }

  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

function flattenRecord(record: JsonRecord, prefix = ""): Array<[string, unknown]> {
  return Object.entries(record).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return isRecord(value) ? flattenRecord(value, path) : [[path, value]]
  })
}

function comparableValue(value: unknown) {
  return JSON.stringify(value) ?? String(value)
}

function buildChanges(before: unknown, after: unknown): AuditMetadataChange[] {
  const beforeEntries = isRecord(before) ? flattenRecord(before) : [["value", before] satisfies [string, unknown]]
  const afterEntries = isRecord(after) ? flattenRecord(after) : [["value", after] satisfies [string, unknown]]
  const beforeMap = new Map(beforeEntries)
  const afterMap = new Map(afterEntries)
  const keys = Array.from(new Set([...beforeMap.keys(), ...afterMap.keys()]))

  return keys.map((key) => {
    const beforeValue = beforeMap.get(key)
    const afterValue = afterMap.get(key)
    return {
      key,
      label: key === "value" ? "Değer" : formatAuditFieldLabel(key),
      before: formatAuditValue(beforeValue, key),
      after: formatAuditValue(afterValue, key),
      changed: comparableValue(beforeValue) !== comparableValue(afterValue),
    }
  })
}

function pairedChangeKeys(metadata: JsonRecord) {
  const pairs = new Map<string, { before?: string; after?: string }>()

  for (const key of Object.keys(metadata)) {
    const match = key.match(/^(before|after)([A-Z].*)$/)
    if (!match) continue

    const [, side, suffix] = match
    const field = suffix.charAt(0).toLocaleLowerCase("tr-TR") + suffix.slice(1)
    const pair = pairs.get(field) ?? {}
    pair[side as "before" | "after"] = key
    pairs.set(field, pair)
  }

  return pairs
}

export function parseAuditMetadata(metadataJson: string | null): ParsedAuditMetadata {
  if (!metadataJson) return { changes: [], details: [], raw: null }

  let parsed: unknown
  try {
    parsed = JSON.parse(metadataJson)
  } catch {
    return { changes: [], details: [], raw: metadataJson }
  }

  if (!isRecord(parsed)) {
    return {
      changes: [],
      details: [{ key: "value", label: "Değer", value: formatAuditValue(parsed) }],
      raw: null,
    }
  }

  const consumed = new Set<string>()
  const changes: AuditMetadataChange[] = []

  if (Object.hasOwn(parsed, "before") || Object.hasOwn(parsed, "after")) {
    consumed.add("before")
    consumed.add("after")
    changes.push(...buildChanges(parsed.before, parsed.after))
  }

  for (const [field, pair] of pairedChangeKeys(parsed)) {
    if (pair.before) consumed.add(pair.before)
    if (pair.after) consumed.add(pair.after)
    const beforeValue = pair.before ? parsed[pair.before] : undefined
    const afterValue = pair.after ? parsed[pair.after] : undefined
    changes.push({
      key: field,
      label: formatAuditFieldLabel(field),
      before: formatAuditValue(beforeValue, field),
      after: formatAuditValue(afterValue, field),
      changed: comparableValue(beforeValue) !== comparableValue(afterValue),
    })
  }

  const details = Object.entries(parsed)
    .filter(([key]) => !consumed.has(key))
    .map(([key, value]) => ({
      key,
      label: formatAuditFieldLabel(key),
      value: formatAuditValue(value, key),
    }))

  return { changes, details, raw: null }
}

export function auditMetadataSummary(metadata: ParsedAuditMetadata) {
  if (metadata.changes.length > 0) {
    const changedCount = metadata.changes.filter((row) => row.changed).length
    return changedCount > 0
      ? `${changedCount} değişiklik · Ayrıntıları görüntüle`
      : `${metadata.changes.length} alan karşılaştırıldı · Ayrıntıları görüntüle`
  }
  if (metadata.details.length > 0) return `${metadata.details.length} ayrıntı · Görüntüle`
  if (metadata.raw) return "Kayıt ayrıntısını görüntüle"
  return "Ayrıntı yok"
}
