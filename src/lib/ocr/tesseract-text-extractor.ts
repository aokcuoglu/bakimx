import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createWorker, OEM, PSM, type Worker } from "tesseract.js"

const TESSERACT_CACHE_PATH = join(tmpdir(), "bakimx-tesseract-cache")

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
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          preserve_interword_spaces: "1",
          user_defined_dpi: "300",
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

export async function extractRegistrationText(imageBuffer: Buffer): Promise<string> {
  let resolveQueue: () => void = () => {}
  const previousJob = recognitionQueue
  recognitionQueue = new Promise<void>((resolve) => {
    resolveQueue = resolve
  })

  await previousJob
  try {
    const worker = await getWorker()
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