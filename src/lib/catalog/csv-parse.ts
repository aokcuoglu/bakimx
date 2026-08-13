/**
 * Bağımlılıksız RFC 4180 CSV ayrıştırıcısı — BakımX katalog içe aktarımı (BAK-34).
 *
 * NEDEN KENDİ AYRIŞTIRICIMIZ: hedef dosya, Türkçe Windows Excel'in
 * "Farklı Kaydet → CSV UTF-8" çıktısıdır. `split(",")` bu dosyada üç ayrı yerden
 * bozulur:
 *   1. TR yerel ayarında Excel'in varsayılan ayracı NOKTALI VİRGÜLdür;
 *   2. açıklama alanı tırnak içinde ayraç ve SATIR SONU taşıyabilir;
 *   3. Excel dosyanın başına UTF-8 BOM (ve bazen `sep=;` satırı) yazar.
 * Yeni bağımlılık eklenmediği için (BAK-30 kararı) ayrıştırma burada, birim
 * testli bir durum makinesiyle yapılır.
 *
 * SATIR NUMARASI: her kayıt, dosyadaki FİZİKSEL başlangıç satırını taşır
 * (`CsvRow.line`, 1 tabanlı). Kullanıcı hatayı Excel'de o satırda bulur; tırnak
 * içi satır sonları numaralandırmayı kaydırır ve kaydırmalıdır.
 */

export const CSV_DELIMITERS = [";", ",", "\t"] as const
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number]

/** TR Excel'in varsayılanı — ayraç hiç tespit edilemezse buna düşülür. */
export const DEFAULT_CSV_DELIMITER: CsvDelimiter = ";"

export const UTF8_BOM = "﻿"

export interface CsvRow {
  /** Kaydın başladığı fiziksel satır numarası (1 tabanlı, başlık dâhil sayılır). */
  line: number
  cells: string[]
}

export interface CsvDocument {
  delimiter: CsvDelimiter
  /** Başlık hücreleri (kırpılmış). Dosya boşsa boş dizi. */
  header: string[]
  /** Veri kayıtları — tamamen boş satırlar atılır. */
  rows: CsvRow[]
  /** `maxRows` aşıldığı için okuma kesildi mi. */
  truncated: boolean
}

export interface CsvParseOptions {
  /** Verilmezse başlık satırından tespit edilir. */
  delimiter?: CsvDelimiter
  /** Kabul edilen en fazla VERİ satırı (başlık hariç). Aşılırsa okuma kesilir. */
  maxRows?: number
}

/** Excel'in yazdığı UTF-8 BOM'unu atar (projenin kendi CSV üreticisi de yazıyor). */
export function stripBom(text: string): string {
  return text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text
}

/**
 * Excel'in bazı yerel ayarlarda ilk satıra yazdığı `sep=;` yönergesi. Varsa hem
 * ayracı verir hem de o satır veriden düşürülür — aksi hâlde başlık satırı
 * "sep=;" olur ve tüm kolon eşlemesi kaybolur.
 */
function readSepDirective(text: string): { delimiter: CsvDelimiter; rest: string } | null {
  const match = /^sep=(.)\r?\n/i.exec(text)
  if (!match) return null
  const candidate = match[1] as CsvDelimiter
  if (!CSV_DELIMITERS.includes(candidate)) return null
  return { delimiter: candidate, rest: text.slice(match[0].length) }
}

/**
 * Ayracı BAŞLIK KAYDINDAN tespit eder: tırnak dışında en çok geçen aday kazanır.
 * Yalnız ilk kayda bakılır — veri satırlarındaki serbest metin ("1.234,56",
 * "Bosch, Almanya") sayımı yanıltır. Beraberlikte `CSV_DELIMITERS` sırası
 * (`;` → `,` → tab) belirleyicidir; TR Excel varsayılanı öne alınmıştır.
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  const directive = readSepDirective(text)
  if (directive) return directive.delimiter

  const body = stripBom(text)
  const counts = new Map<CsvDelimiter, number>(CSV_DELIMITERS.map((d) => [d, 0]))
  let inQuotes = false

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') i++
        else inQuotes = false
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === "\n" || ch === "\r") break
    const known = CSV_DELIMITERS.find((d) => d === ch)
    if (known) counts.set(known, (counts.get(known) ?? 0) + 1)
  }

  let best: CsvDelimiter = DEFAULT_CSV_DELIMITER
  let bestCount = 0
  for (const delimiter of CSV_DELIMITERS) {
    const count = counts.get(delimiter) ?? 0
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/**
 * RFC 4180 ayrıştırması: tırnaklı alanlar, alan içi ayraç/satır sonu, `""`
 * ile kaçırılmış tırnak, CRLF ve LF karışımı.
 *
 * Kapanmamış tırnak bir HATA DEĞİLDİR: dosyanın sonuna kadar okunur ve kayıt
 * neyse odur. Excel bu dosyayı zaten üretmez; ürettiğinde de tek bir bozuk
 * satır yüzünden partiyi düşürmek yerine o satır doğrulamada hata verir.
 */
export function parseCsv(text: string, options: CsvParseOptions = {}): CsvDocument {
  const directive = readSepDirective(stripBom(text))
  const body = directive ? directive.rest : stripBom(text)
  const delimiter = options.delimiter ?? directive?.delimiter ?? detectCsvDelimiter(text)
  const maxRows = options.maxRows

  const rows: CsvRow[] = []
  let header: string[] | null = null
  let truncated = false

  let cells: string[] = []
  let field = ""
  // `sep=` yönergesi gövdeden düşürüldü ama dosyada bir satır kaplıyor: bildirilen
  // satır numarası kullanıcının Excel'de gördüğüyle aynı kalmalı.
  let line = directive ? 2 : 1
  let recordLine = line
  let inQuotes = false
  let started = false

  /** Biten kaydı yerine koyar; boş kayıtları (Excel'in kuyruk satır sonu) atar. */
  const flushRecord = (): boolean => {
    cells.push(field)
    field = ""
    const record = cells
    cells = []
    started = false

    const isBlank = record.every((cell) => cell.trim() === "")
    if (isBlank) return true

    if (header === null) {
      header = record.map((cell) => cell.trim())
      return true
    }
    if (maxRows !== undefined && rows.length >= maxRows) {
      truncated = true
      return false
    }
    rows.push({ line: recordLine, cells: record })
    return true
  }

  for (let i = 0; i < body.length; i++) {
    const ch = body[i]

    if (!started) {
      recordLine = line
      started = true
    }

    if (inQuotes) {
      if (ch === '"') {
        if (body[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
        continue
      }
      // Alan içi satır sonu LF'e indirgenir: aynı açıklama metni CRLF ve LF
      // kaydedilmiş iki dosyada aynı değeri üretsin (idempotensi).
      if (ch === "\r") {
        if (body[i + 1] === "\n") continue
        line++
        field += "\n"
        continue
      }
      if (ch === "\n") line++
      field += ch
      continue
    }

    if (ch === '"') {
      // Tırnak yalnız alanın BAŞINDA alan açar; ortadaki tırnak ("12"" boru")
      // düz karakterdir — Excel de böyle okur.
      if (field === "") inQuotes = true
      else field += ch
      continue
    }

    if (ch === delimiter) {
      cells.push(field)
      field = ""
      continue
    }

    if (ch === "\r") {
      if (body[i + 1] === "\n") i++
      line++
      if (!flushRecord()) break
      continue
    }

    if (ch === "\n") {
      line++
      if (!flushRecord()) break
      continue
    }

    field += ch
  }

  if (!truncated && (started || field !== "" || cells.length > 0)) flushRecord()

  return { delimiter, header: header ?? [], rows, truncated }
}
