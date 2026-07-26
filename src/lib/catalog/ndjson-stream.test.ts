import { afterAll, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { tmpdir } from "node:os"
import path from "node:path"
import { streamNdjsonBatches } from "@/lib/catalog/ndjson-stream"

const dir = mkdtempSync(path.join(tmpdir(), "ndjson-stream-"))

afterAll(() => rmSync(dir, { recursive: true, force: true }))

function gzFixture(name: string, lines: string[]): string {
  const file = path.join(dir, name)
  writeFileSync(file, gzipSync(Buffer.from(lines.join("\n"))))
  return file
}

function rowLines(n: number): string[] {
  return Array.from({ length: n }, (_, i) => JSON.stringify({ id: i + 1 }))
}

test("hands rows over in batches and returns the total", async () => {
  const file = gzFixture("exact.ndjson.gz", rowLines(6))
  const batches: { id: number }[][] = []

  const total = await streamNdjsonBatches<{ id: number }>(file, 2, async (rows) => {
    batches.push([...rows])
  })

  expect(total).toBe(6)
  expect(batches.map((b) => b.length)).toEqual([2, 2, 2])
  expect(batches.flat().map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6])
})

test("flushes the trailing partial batch", async () => {
  const file = gzFixture("remainder.ndjson.gz", rowLines(7))
  const sizes: number[] = []

  const total = await streamNdjsonBatches<{ id: number }>(file, 3, async (rows) => {
    sizes.push(rows.length)
  })

  expect(total).toBe(7)
  expect(sizes).toEqual([3, 3, 1])
})

// The whole point of the helper: peak memory is one batch, never the file.
test("never exceeds the batch size", async () => {
  const file = gzFixture("big.ndjson.gz", rowLines(5000))
  let max = 0

  const total = await streamNdjsonBatches<{ id: number }>(file, 500, async (rows) => {
    max = Math.max(max, rows.length)
  })

  expect(total).toBe(5000)
  expect(max).toBe(500)
})

test("skips blank lines, including a trailing newline", async () => {
  const file = gzFixture("blanks.ndjson.gz", [...rowLines(2), "", "   ", ""])
  const seen: { id: number }[] = []

  const total = await streamNdjsonBatches<{ id: number }>(file, 10, async (rows) => {
    seen.push(...rows)
  })

  expect(total).toBe(2)
  expect(seen).toEqual([{ id: 1 }, { id: 2 }])
})

test("does not call onBatch for an empty file", async () => {
  const file = gzFixture("empty.ndjson.gz", [])
  let calls = 0

  const total = await streamNdjsonBatches<{ id: number }>(file, 10, async () => {
    calls++
  })

  expect(total).toBe(0)
  expect(calls).toBe(0)
})
