import { test, expect } from "bun:test"
import { detectCsvDelimiter, parseCsv, stripBom, UTF8_BOM } from "./csv-parse"

test("stripBom removes only a leading UTF-8 BOM", () => {
  expect(stripBom(`${UTF8_BOM}Ürün Kodu`)).toBe("Ürün Kodu")
  expect(stripBom("Ürün Kodu")).toBe("Ürün Kodu")
  expect(stripBom(`Ürün${UTF8_BOM}Kodu`)).toBe(`Ürün${UTF8_BOM}Kodu`)
})

test("detectCsvDelimiter reads the header line only", () => {
  // Veri satırındaki "1.234,56" virgülleri sayıma girseydi ayraç yanlış seçilirdi.
  expect(detectCsvDelimiter("Kod;Ad;Fiyat\nA1;Akü;1.234,56\nA2;Filtre;99,90")).toBe(";")
  expect(detectCsvDelimiter("Kod,Ad,Fiyat\nA1,Akü,1234.56")).toBe(",")
  expect(detectCsvDelimiter("Kod\tAd\tFiyat\nA1\tAkü\t1234.56")).toBe("\t")
})

test("detectCsvDelimiter ignores delimiters inside quoted header cells", () => {
  expect(detectCsvDelimiter('"Kod;Numara";Ad;Fiyat\n')).toBe(";")
  expect(detectCsvDelimiter('"Ad, Marka",Kod\n')).toBe(",")
})

test("detectCsvDelimiter falls back to the TR Excel default", () => {
  expect(detectCsvDelimiter("TekKolon\nA1\n")).toBe(";")
})

test("detectCsvDelimiter honours an Excel sep= directive", () => {
  expect(detectCsvDelimiter("sep=;\nKod,Ad\nA1,Akü\n")).toBe(";")
})

test("parseCsv reads a TR Excel export: BOM + semicolons + CRLF", () => {
  const doc = parseCsv(`${UTF8_BOM}Ürün Kodu;Ürün Adı;Fiyat\r\nA1;Akü 60Ah;1.234,56\r\nA2;Yağ Filtresi;99,90\r\n`)
  expect(doc.delimiter).toBe(";")
  expect(doc.header).toEqual(["Ürün Kodu", "Ürün Adı", "Fiyat"])
  expect(doc.rows).toEqual([
    { line: 2, cells: ["A1", "Akü 60Ah", "1.234,56"] },
    { line: 3, cells: ["A2", "Yağ Filtresi", "99,90"] },
  ])
  expect(doc.truncated).toBe(false)
})

test("parseCsv keeps quoted delimiters and doubled quotes", () => {
  const doc = parseCsv('Kod;Ad\nA1;"Bosch; Almanya"\nA2;"12"" boru"\n')
  expect(doc.rows[0].cells).toEqual(["A1", "Bosch; Almanya"])
  expect(doc.rows[1].cells).toEqual(["A2", '12" boru'])
})

test("parseCsv keeps an embedded newline and shifts the following line numbers", () => {
  const doc = parseCsv('Kod;Açıklama\nA1;"Birinci satır\nİkinci satır"\nA2;Tek satır\n')
  expect(doc.rows[0]).toEqual({ line: 2, cells: ["A1", "Birinci satır\nİkinci satır"] })
  // Gömülü satır sonu iki fiziksel satır tüketti: sıradaki kayıt 4. satırda.
  expect(doc.rows[1]).toEqual({ line: 4, cells: ["A2", "Tek satır"] })
})

test("parseCsv normalises an embedded CRLF to LF", () => {
  const doc = parseCsv('Kod;Açıklama\r\nA1;"Bir\r\nİki"\r\n')
  expect(doc.rows[0].cells[1]).toBe("Bir\nİki")
})

test("parseCsv drops blank records but keeps rows whose cells are empty on purpose", () => {
  const doc = parseCsv("Kod;Ad;Fiyat\nA1;;100\n\n;;\nA2;Filtre;200\n")
  expect(doc.rows).toEqual([
    { line: 2, cells: ["A1", "", "100"] },
    { line: 5, cells: ["A2", "Filtre", "200"] },
  ])
})

test("parseCsv tolerates a missing trailing newline and a lone CR", () => {
  expect(parseCsv("Kod;Ad\nA1;Akü").rows).toEqual([{ line: 2, cells: ["A1", "Akü"] }])
  expect(parseCsv("Kod;Ad\rA1;Akü\r").rows).toEqual([{ line: 2, cells: ["A1", "Akü"] }])
})

test("parseCsv skips the sep= directive line instead of reading it as the header", () => {
  const doc = parseCsv(`${UTF8_BOM}sep=;\nÜrün Kodu;Ürün Adı\nA1;Akü\n`)
  expect(doc.header).toEqual(["Ürün Kodu", "Ürün Adı"])
  expect(doc.rows).toEqual([{ line: 3, cells: ["A1", "Akü"] }])
})

test("parseCsv stops at maxRows and reports truncation", () => {
  const text = ["Kod;Ad", ...Array.from({ length: 10 }, (_, i) => `A${i};Ürün ${i}`)].join("\n")
  const doc = parseCsv(text, { maxRows: 4 })
  expect(doc.rows).toHaveLength(4)
  expect(doc.truncated).toBe(true)
})

test("parseCsv returns an empty document for empty input", () => {
  expect(parseCsv("")).toEqual({ delimiter: ";", header: [], rows: [], truncated: false })
  expect(parseCsv(UTF8_BOM).rows).toEqual([])
})

test("parseCsv treats an unterminated quote as text to the end of file", () => {
  const doc = parseCsv('Kod;Ad\nA1;"Kapanmamış\n')
  expect(doc.rows).toEqual([{ line: 2, cells: ["A1", "Kapanmamış\n"] }])
})
