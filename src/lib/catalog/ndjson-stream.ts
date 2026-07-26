import { createReadStream } from "node:fs"
import { createGunzip } from "node:zlib"
import { createInterface } from "node:readline"

/**
 * Read a gzipped NDJSON file and hand its rows to `onBatch` in fixed-size batches.
 *
 * The catalog fixtures are large (vehicle_type_details is 37.9k rows carrying raw_payload),
 * so buffering a whole file — let alone all four plus a mapped copy — blew past the 512 MB
 * seed task and got it SIGKILLed (exit 137). Iterating the readline interface with `for await`
 * applies backpressure: the gunzip stream pauses while `onBatch` runs, so peak memory stays at
 * one batch regardless of file size.
 *
 * Returns the number of rows read (blank lines skipped).
 */
export async function streamNdjsonBatches<T>(
  filePath: string,
  batchSize: number,
  onBatch: (rows: T[]) => Promise<void>,
): Promise<number> {
  const rl = createInterface({ input: createReadStream(filePath).pipe(createGunzip()) })
  let batch: T[] = []
  let total = 0

  for await (const line of rl) {
    if (!line.trim()) continue
    batch.push(JSON.parse(line) as T)
    if (batch.length >= batchSize) {
      total += batch.length
      await onBatch(batch)
      batch = []
    }
  }

  if (batch.length > 0) {
    total += batch.length
    await onBatch(batch)
  }

  return total
}
