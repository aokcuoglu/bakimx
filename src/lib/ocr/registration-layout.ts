import type { TessWord } from "./tesseract-text-extractor"

// Ruhsat alan tanımı
type FieldDef = {
  name: string
  // Etiketi bulmak için anahtar kelimeler (büyük harf normalize edilmiş)
  labels: string[]
  // Değer etiketin sağında mı (right) yoksa alt satırında mı (below)?
  direction: "right" | "below"
  // Regex fallback için kullanılacak label pattern (isteğe bağlı)
  labelPattern?: string
}

const FIELD_DEFS: FieldDef[] = [
  {
    name: "brand",
    labels: ["D.1", "D1", "D,1", "MARKA", "MARKASI"],
    direction: "right",
  },
  {
    name: "model",
    labels: ["D.3", "D3", "D,3", "TİCARİ", "TICARI", "TICARİ", "TİCARI"],
    direction: "right",
  },
  {
    name: "vehicleType",
    labels: ["D.5", "D5", "D,5", "CİNSİ", "CINSI", "CINSİ", "CİNSI"],
    direction: "right",
  },
  {
    name: "modelYear",
    labels: ["D.4", "D4", "D,4", "MODEL YILI", "MODELYILI"],
    direction: "right",
  },
  {
    name: "engineNo",
    labels: ["P.5", "P5", "P,5", "MOTOR", "MOTORNO"],
    direction: "right",
  },
  {
    name: "vin",
    labels: ["ŞASE", "SASE", "ŞASENO", "SASENO"],
    direction: "right",
  },
  {
    name: "ownerName",
    labels: ["C.1.2", "C12", "ADI"],
    direction: "right",
  },
  {
    name: "ownerSurname",
    labels: ["C.1.1", "C11", "SOYADI", "SOYAD"],
    direction: "right",
  },
  {
    name: "registrationDate",
    labels: ["TESCİL", "TESCIL", "TESCİL TARİHİ", "TESCIL TARIHI"],
    direction: "right",
  },
]

// Plaka regex
const PLATE_RE = /\b(\d{2}\s?[0OQCBGÇĞİÖŞÜA-Z]{1,3}\s?\d{2,4})\b/

// Grup kelimeleri satırlarına göre (y koordinatı bazlı)
function groupWordsIntoLines(words: TessWord[]): TessWord[][] {
  if (words.length === 0) return []

  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0)
  const lines: TessWord[][] = []
  let currentLine: TessWord[] = [sorted[0]]
  let currentY = sorted[0].bbox.y0

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i]
    // Aynı satır: y farkı ortalama kelime yüksekliğinin yarısından azsa
    const lineHeight = currentLine[0].bbox.y1 - currentLine[0].bbox.y0
    if (Math.abs(word.bbox.y0 - currentY) < lineHeight * 0.7) {
      currentLine.push(word)
    } else {
      currentLine.sort((a, b) => a.bbox.x0 - b.bbox.x0)
      lines.push(currentLine)
      currentLine = [word]
      currentY = word.bbox.y0
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.bbox.x0 - b.bbox.x0)
    lines.push(currentLine)
  }

  return lines
}

// Bir kelimenin normalize edilmiş metni (büyük harf, nokta/virgül toleranslı)
function norm(word: string): string {
  return word.toUpperCase().replace(/[.,\s-]/g, "")
}

// Bir kelimenin label anahtar kelimelerinden birini içerip içermediğini kontrol et
function matchesLabel(wordText: string, labels: string[]): boolean {
  const n = norm(wordText)
  for (const label of labels) {
    const ln = norm(label)
    if (n === ln || n.startsWith(ln) || n.endsWith(ln) || n.includes(ln)) {
      return true
    }
  }
  return false
}

// Ana etiket kelimesini bul (örn: "D.1 MARKASI" içinde "D.1" geçiyorsa)
// ve bu etiketin başlangıç indeksini döndür
function findLabelWordIndex(line: TessWord[], labels: string[]): number {
  for (let i = 0; i < line.length; i++) {
    if (matchesLabel(line[i].text, labels)) {
      // Etiket kelimesi birden fazla kelimeye yayılmış olabilir
      // "MODEL YILI" → iki kelime. Bunu handle etmek için
      // birkaç kelimeyi birleştirip kontrol et
      for (let span = 1; span <= 3 && i + span <= line.length; span++) {
        const combined = line
          .slice(i, i + span)
          .map((w) => w.text)
          .join(" ")
        if (matchesLabel(combined, labels)) {
          return i
        }
      }
      return i
    }
  }
  return -1
}

export function spatialParseFields(words: TessWord[]): Record<string, string> {
  const fields: Record<string, string> = {
    plate: "",
    vin: "",
    ownerName: "",
    ownerSurname: "",
    brand: "",
    model: "",
    vehicleType: "",
    modelYear: "",
    engineNo: "",
    registrationDate: "",
  }

  // Plaka: tüm kelime metinlerinde ara
  const fullText = words.map((w) => w.text).join(" ")
  const plateMatch = fullText.match(PLATE_RE)
  if (plateMatch) {
    fields.plate = plateMatch[1].trim()
  }

  // Kelimeleri satırlara grupla
  const lines = groupWordsIntoLines(words)

  // Her alan için etiketi bul ve değeri çıkar
  for (const def of FIELD_DEFS) {
    let value = ""
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]
      const labelIdx = findLabelWordIndex(line, def.labels)
      if (labelIdx === -1) continue

      if (def.direction === "right") {
        // Değer aynı satırda etiketin sağında
        const valueWords = line.slice(labelIdx + 1)
        // Etiketle karışmış olabilecek kelimeleri filtrele
        const cleanWords = valueWords.filter((w) => {
          // etiket anahtar kelimesi kalmış olabilir
          for (const label of def.labels) {
            if (matchesLabel(w.text, [label])) return false
            // Numerik/model yılı gibi değerleri koru
          }
          return true
        })
        if (cleanWords.length > 0) {
          value = cleanWords.map((w) => w.text).join(" ").trim()
        }
      } else if (def.direction === "below" && li + 1 < lines.length) {
        // Değer alt satırda
        value = lines[li + 1].map((w) => w.text).join(" ").trim()
      }

      if (value) break
    }

    if (value) {
      fields[def.name] = value
    }
  }

  return fields
}
