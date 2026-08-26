import { expect, test } from "bun:test"
import { auditMetadataSummary, formatAuditFieldLabel, parseAuditMetadata } from "./audit-metadata"

test("before ve after nesnelerini alan bazında karşılaştırır", () => {
  const metadata = parseAuditMetadata(JSON.stringify({
    before: { acquisitionSource: "field_visit", acquisitionAdvisorId: null },
    after: { acquisitionSource: "instagram", acquisitionAdvisorId: "advisor-1" },
  }))

  expect(metadata.changes).toEqual([
    {
      key: "acquisitionSource",
      label: "Edinim kaynağı",
      before: "Saha ziyareti",
      after: "Instagram",
      changed: true,
    },
    {
      key: "acquisitionAdvisorId",
      label: "Satış temsilcisi",
      before: "—",
      after: "advisor-1",
      changed: true,
    },
  ])
  expect(auditMetadataSummary(metadata)).toBe("2 değişiklik · Ayrıntıları görüntüle")
})

test("eşit before ve after değerlerini karşılaştırma olarak korur", () => {
  const metadata = parseAuditMetadata(JSON.stringify({ before: { enabled: true }, after: { enabled: true } }))

  expect(metadata.changes[0]).toMatchObject({ before: "Evet", after: "Evet", changed: false })
  expect(auditMetadataSummary(metadata)).toBe("1 alan karşılaştırıldı · Ayrıntıları görüntüle")
})

test("beforeBps ve afterBps gibi eşlenmiş alanları destekler", () => {
  const metadata = parseAuditMetadata(JSON.stringify({ beforeBps: 100, afterBps: 250, reason: "kampanya" }))

  expect(metadata.changes).toEqual([
    { key: "bps", label: "Bps", before: "100", after: "250", changed: true },
  ])
  expect(metadata.details).toEqual([
    { key: "reason", label: "Reason", value: "kampanya" },
  ])
})

test("before ve after içermeyen metadata ayrıntı listesine dönüşür", () => {
  const metadata = parseAuditMetadata(JSON.stringify({ featureKey: "ocrIntake", enabled: false }))

  expect(metadata.changes).toHaveLength(0)
  expect(metadata.details).toEqual([
    { key: "featureKey", label: "Özellik", value: "ocrIntake" },
    { key: "enabled", label: "Etkin", value: "Hayır" },
  ])
})

test("geçersiz JSON ham kayıt olarak korunur", () => {
  expect(parseAuditMetadata("{bozuk")).toEqual({ changes: [], details: [], raw: "{bozuk" })
  expect(formatAuditFieldLabel("profile.displayName")).toBe("Profile · Display Name")
})
