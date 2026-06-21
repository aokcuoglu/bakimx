import type { OcrProvider, RegistrationOcrResult } from "./types"
import {
  extractRegistrationText,
  extractRegistrationWords,
  terminateTesseractWorker,
  type TessWord,
} from "./tesseract-text-extractor"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"
import { spatialParseFields } from "./registration-layout"
import { PSM } from "tesseract.js"

// Regex pattern'leri (yedek) — Python registration_ocr.py ile birebir uyumlu
const LABEL_PATTERNS: Array<[string, RegExp]> = [
  ["brand", /(D[.,\s]?[1lI|]\s*[^\n]*?(?:MARKA(?:S[İIY1]*)?))/i],
  ["model", /(D[.,\s]?[3Ss8]\s*[^\n]*?(?:T[İI1]CAR[İI1]\s*AD(?:[LIY1]*[İI1]*)?))/i],
  ["vehicleType", /(D[.,\s]?[5SsEe]\s*[^\n]*?(?:C[İI1]NS[İI1](?:[LIY1]*[İI1]*)?))/i],
  ["modelYear", /(D[.,\s]?[4]\s*[^\n]*?(?:MODEL\s*YIL[İI1](?:[LIY1]*[İI1]*)?))/i],
  ["engineNo", /(P[.,\s]?[5SsEe]\s*[^\n]*?(?:MOTOR\s*(?:N[O0]\b)?))/i],
  ["vin", /(E?\s*[^\n]*?(?:Ş?ASE\s*(?:N[O0]\b)?|[ÇC]ASE\s*(?:N[O0]\b)?))/i],
  ["ownerName", /([C.]?[.,\s]?1[.,\s]?2\s*[^\n]*?(?:AD(?:[LIY1]*[İI1]*)?))/i],
  ["ownerSurname", /([C.]?[.,\s]?1[.,\s]?1\s*[^\n]*?(?:SOYAD(?:[LIY1]*[İI1]*)?|[ÜU]NVAN(?:L[IG1]*[ĞI1]*)?))/i],
  ["registrationDate", /(I?\s*[^\n]*?(?:TESC[İI1]L\s*TAR[İI1][HM][İI1](?:[İI1][ÇC1]*)?))/i],
]

const PLATE_RE = /\b(\d{2}\s?[0OQCBGÇĞİÖŞÜA-Z]{1,3}\s?\d{2,4})\b/

const LABEL_KEYWORDS_RE = /(?:MARKA|MARKASI|T[İI]CAR[İI]\s*AD|C[İI]NS[İI]|MODEL\s*YILI|MOTOR|Ş?ASE|SOYAD[LI]?|[ÜU]NVAN|TESC[İI]L|TAR[İI]H|D[.,]?\s*\d|C[.,]?\s*1|P[.,]?\s*\d|^\s*E\b|^\s*I\b)/i
const MODEL_YEAR_LABEL_RE = /\bD[.,]?\s*4\b|MODEL\s+YILI/i
const YEAR_RE = /\b(?:19|20)\d{2}\b/g

function cleanLabelLine(line: string, match: RegExpExecArray): string {
  return line.slice(match.index + match[0].length).trim()
}

function stripNonvalueChars(s: string): string {
  s = s.replace(/^[\s:,.\-=|!@#$%^&*]+/, "")
  s = s.replace(/[\s:,.\-=|!@#$%^&*]+$/, "")
  s = s.replace(/^[1I0N][\s]+(?=[A-ZÇĞİÖŞÜ0-9]{2,})/i, "")
  return s.trim()
}

function isLabelLine(line: string): boolean {
  if (LABEL_KEYWORDS_RE.test(line) && line.length < 40) {
    return true
  }
  return false
}

function extractModelYear(rawText: string): string | null {
  const lines = rawText.split(/\r?\n/)
  const labelIndex = lines.findIndex((line) => MODEL_YEAR_LABEL_RE.test(line))
  if (labelIndex === -1) return null
  const currentYear = new Date().getFullYear()
  const nearbyText = lines.slice(labelIndex, labelIndex + 10).join(" ")
  const years = nearbyText.match(YEAR_RE) || []
  for (const year of years) {
    const n = Number(year)
    if (n >= 1900 && n <= currentYear + 1) return year
  }
  return null
}

function reconcileFields(fields: Record<string, string>, rawText: string): Record<string, string> {
  const modelYear = extractModelYear(rawText)
  if (modelYear && !fields.modelYear) {
    fields.modelYear = modelYear
  }
  return fields
}

function parseFieldsRegex(rawText: string): Record<string, string> {
  const fields: Record<string, string> = {
    plate: "", vin: "", ownerName: "", ownerSurname: "", brand: "",
    model: "", vehicleType: "", modelYear: "", engineNo: "", registrationDate: "",
  }
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const plateMatch = rawText.match(PLATE_RE)
  if (plateMatch) fields.plate = plateMatch[1].trim()
  for (const [fieldName, pattern] of LABEL_PATTERNS) {
    let value = ""
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = pattern.exec(line)
      if (!match) continue
      value = stripNonvalueChars(cleanLabelLine(line, match))
      if (value) break
      for (let j = 1; j <= 3; j++) {
        const nextLine = lines[i + j]
        if (!nextLine) break
        const cand = stripNonvalueChars(nextLine)
        if (cand && !isLabelLine(cand)) { value = cand; break }
      }
      if (value) break
    }
    fields[fieldName] = value
  }
  return fields
}

function countFields(fields: Record<string, string>): number {
  return Object.values(fields).filter((v) => v.trim().length > 0).length
}

function mergeFields(base: Record<string, string>, fallback: Record<string, string>): Record<string, string> {
  // fallback tüm alanları içerir (10 field), base'deki değerler öncelikli
  return { ...fallback, ...base }
}

function toConfidenceResult(
  fields: Record<string, string>,
  rawText: string
): Omit<RegistrationOcrResult, "provider"> {
  const parsed = RegistrationFieldsSchema.parse(fields)
  const result = toRegistrationResult(parsed, rawText)
  return {
    ...result,
    plate: { ...result.plate, confidence: result.plate.value ? 0.6 : 0 },
    vin: { ...result.vin, confidence: result.vin.value ? 0.6 : 0 },
    ownerName: { ...result.ownerName, confidence: result.ownerName.value ? 0.5 : 0 },
    ownerSurname: { ...result.ownerSurname, confidence: result.ownerSurname.value ? 0.5 : 0 },
    brand: { ...result.brand, confidence: result.brand.value ? 0.6 : 0 },
    model: { ...result.model, confidence: result.model.value ? 0.6 : 0 },
    vehicleType: { ...result.vehicleType, confidence: result.vehicleType.value ? 0.5 : 0 },
    modelYear: { ...result.modelYear, confidence: result.modelYear.value ? 0.6 : 0 },
    engineNo: { ...result.engineNo, confidence: result.engineNo.value ? 0.5 : 0 },
    registrationDate: { ...result.registrationDate, confidence: result.registrationDate.value ? 0.5 : 0 },
  }
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "tesseract" as const

  async extractRegistration(imageBuffer: Buffer, _mimeType: string): Promise<RegistrationOcrResult> {
    // --- AŞAMA 1: Spatial OCR (pozisyon bazlı okuma, kelime bounding box'ları ile) ---
    let words: TessWord[]
    try {
      words = await extractRegistrationWords(imageBuffer, PSM.SINGLE_BLOCK)
    } catch {
      // Kelime çıkarılamadıysa direkt text'e düş
      words = []
    }

    let spatialFields: Record<string, string> = {}
    let spatialText = ""
    if (words.length > 0) {
      spatialFields = spatialParseFields(words)
      spatialText = words.map((w) => w.text).join("\n")
    }

    const fieldCount = countFields(spatialFields)

    // --- AŞAMA 2: Yedek olarak regex parser ---
    let regexFields: Record<string, string> = {}
    let regexText = ""
    try {
      regexText = await extractRegistrationText(imageBuffer, PSM.SINGLE_BLOCK)
      if (regexText.trim()) {
        regexFields = parseFieldsRegex(regexText)
        const regexCount = countFields(regexFields)
        if (regexCount > fieldCount) {
          // Regex daha çok alan bulduysa onun text'ini kullan
          spatialText = regexText
        }
      }
    } catch {
      // Regex de başarısız olursa sadece spatial sonuçları kullan
    }

    // --- AŞAMA 3: Spatial + regex birleştir ---
    const mergedFields = mergeFields(spatialFields, regexFields)
    const mergedCount = countFields(mergedFields)

    // --- AŞAMA 4: Hala yetersizse PSM SPARSE_TEXT ile tekrar dene ---
    if (mergedCount < 5) {
      try {
        const retryWords = await extractRegistrationWords(imageBuffer, PSM.SPARSE_TEXT)
        if (retryWords.length > 0) {
          const retrySpatial = spatialParseFields(retryWords)
          const retryText = retryWords.map((w) => w.text).join("\n")
          const retryCount = countFields(retrySpatial)
          if (retryCount > mergedCount) {
            Object.assign(mergedFields, mergeFields(mergedFields, retrySpatial))
            spatialText = retryText
          } else {
            Object.assign(mergedFields, mergeFields(mergedFields, retrySpatial))
          }
        }
      } catch {
        // sessizce geç
      }
    }

    const reconciledFields = reconcileFields(mergedFields, spatialText)
    const hasAnyField = Object.values(reconciledFields).some((v) => v.trim().length > 0)
    if (!hasAnyField) {
      throw new Error("Ruhsat alanları okunamadı. Lütfen daha net bir fotoğraf çekin.")
    }

    const result = toConfidenceResult(reconciledFields, spatialText)
    return { ...result, provider: "tesseract" }
  }
}

export { terminateTesseractWorker }
