import type { CsvDocument, CsvRow } from "@/lib/catalog/csv-parse"

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function scalarCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}

/**
 * JSON katalog dosyasını CSV çekirdeğinin kullandığı tablo sözleşmesine çevirir.
 * Dizi ve Supabase benzeri sayısal anahtarlı nesne dışa aktarımları kabul edilir.
 * Şema çıkarımı tüm satırları tarar; sonradan beliren alanlar kaybolmaz.
 */
export function parseJsonImport(text: string, maxRows: number): CsvDocument | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: "JSON dosyası geçerli değil." }
  }

  const values = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Object.keys(parsed).every((key) => /^\d+$/.test(key))
      ? Object.entries(parsed)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, value]) => value)
      : null

  if (!values) return { error: "JSON kökü bir ürün dizisi veya sayısal anahtarlı ürün nesnesi olmalıdır." }
  if (values.some((value) => !isRecord(value))) return { error: "JSON içindeki her ürün bir nesne olmalıdır." }

  const records = values as JsonRecord[]
  const header: string[] = []
  const seen = new Set<string>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key)
        header.push(key)
      }
    }
  }

  const limited = records.slice(0, maxRows)
  const rows: CsvRow[] = limited.map((record, index) => ({
    line: index + 1,
    cells: header.map((key) => scalarCell(record[key])),
  }))

  return { delimiter: ",", header, rows, truncated: records.length > maxRows }
}
