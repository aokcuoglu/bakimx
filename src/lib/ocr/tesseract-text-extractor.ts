import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWorker, OEM, PSM, type Worker } from "tesseract.js"

const TESSERACT_CACHE_PATH = join(tmpdir(), "bakimx-tesseract-cache")

// Türk ruhsat belgesi için geçerli karakterler
const CHAR_WHITELIST =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZÇĞİÖŞÜ0123456789()-/:., "

// Tesseract.js tarafından döndürülen kelime tipi
export type TessWord = {
  text: string
  bbox: { x0: number; y0: number; x1: number; y1: number }
  confidence: number
}

/**
 * Tesseract.js worker lifecycle:
 *
 * - The worker is initialized lazily on first recognition request.
 * - Subsequent requests are queued and processed sequentially.
 * - Call `terminateTesseractWorker()` to shut down the worker when the
 *   application is shutting down or when OCR is no longer needed.
 * - If the worker fails to initialize, the promise is cleared so the next
 *   request will try again.
 * - In serverless/edge environments, the worker may not persist across
 *   invocations. This is a known limitation documented here.
 */

let workerPromise: Promise<Worker> | null = null
let recognitionQueue: Promise<void> = Promise.resolve()

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    await mkdir(TESSERACT_CACHE_PATH, { recursive: true })
    workerPromise = createWorker(["tur", "eng"], OEM.LSTM_ONLY, {
      cachePath: TESSERACT_CACHE_PATH,
    })
      .then(async (worker) => {
        await worker.setParameters({
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
          tessedit_char_whitelist: CHAR_WHITELIST,
        })
        return worker
      })
      .catch((error) => {
        workerPromise = null
        throw error
      })
  }

  return workerPromise
}

export async function extractRegistrationText(
  imageBuffer: Buffer,
  psm: PSM = PSM.SINGLE_BLOCK
): Promise<string> {
  let resolveQueue: () => void = () => {}
  const previousJob = recognitionQueue
  recognitionQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve
  })

  await previousJob
  try {
    const worker = await getWorker()
    await worker.setParameters({ tessedit_pageseg_mode: psm })
    const result = await worker.recognize(imageBuffer, { rotateAuto: true })
    const text = result.data.text.trim()

    if (!text) {
      throw new Error("Ruhsat fotoğrafından okunabilir metin çıkarılamadı")
    }

    return text
  } finally {
    resolveQueue()
  }
}

export async function extractRegistrationWords(
  imageBuffer: Buffer,
  psm: PSM = PSM.SINGLE_BLOCK
): Promise<TessWord[]> {
  let resolveQueue: () => void = () => {}
  const previousJob = recognitionQueue
  recognitionQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve
  })

  await previousJob
  try {
    const worker = await getWorker()
    await worker.setParameters({ tessedit_pageseg_mode: psm })
    const result = await worker.recognize(imageBuffer, { rotateAuto: true })
    const page = result.data

    // Tesseract.js v7: Page → Block[] → Paragraph[] → Line[] → Word[]
    const words: TessWord[] = []
    if (page.blocks) {
      for (const block of page.blocks) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            for (const word of line.words) {
              words.push({
                text: word.text,
                bbox: { x0: word.bbox.x0, y0: word.bbox.y0, x1: word.bbox.x1, y1: word.bbox.y1 },
                confidence: word.confidence,
              })
            }
          }
        }
      }
    }

    if (words.length === 0) {
      // Hiç kelime bulunamadıysa text çıktısını dene
      if (!page.text?.trim()) {
        throw new Error("Ruhsat fotoğrafından okunabilir metin çıkarılamadı")
      }
      // Text var ama word yok — boş array dön, provider alt akışa geçsin
      return []
    }

    return words
  } finally {
    resolveQueue()
  }
}

export async function terminateTesseractWorker(): Promise<void> {
  if (workerPromise) {
    const currentPromise = workerPromise
    workerPromise = null
    try {
      const worker = await currentPromise
      await worker.terminate()
    } catch {
      // Worker may already be terminated or failed to initialize
    }
  }
}
