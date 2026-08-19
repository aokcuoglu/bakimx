import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const SRC = join(import.meta.dir, "..")
const SCOPES = [
  join(SRC, "app", "admin"),
  join(SRC, "app", "(app)", "analytics"),
  join(SRC, "app", "(app)", "reports"),
  join(SRC, "app", "(app)", "settings"),
  join(SRC, "components", "settings"),
]

const SHELL_FILES = [
  join(SRC, "components", "layout", "app-shell.tsx"),
  join(SRC, "components", "ui", "sidebar.tsx"),
]

function tsxFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) tsxFiles(path, files)
    else if (entry.endsWith(".tsx")) files.push(path)
  }
  return files
}

test("yönetim yüzeylerinde görünür ham interaktif kontrol yok", () => {
  const offenders: string[] = []
  for (const file of [...SCOPES.flatMap((scope) => tsxFiles(scope)), ...SHELL_FILES]) {
    const source = readFileSync(file, "utf8").replace(/<input\b[^>]*type=["']hidden["'][^>]*\/>/gs, "")
    source.split("\n").forEach((line, index) => {
      if (/<(?:button|input|select|textarea)\b/.test(line)) {
        offenders.push(`${relative(SRC, file)}:${index + 1}`)
      }
    })
  }
  expect(offenders).toEqual([])
})

test("yönetim yüzeylerinde sabit durum rengi yok", () => {
  const fixedStatusColor = /\b(?:text|bg|border)-(?:red|green|yellow|amber|orange|emerald|rose|blue)-\d{2,3}\b/
  const offenders: string[] = []
  for (const file of SCOPES.flatMap((scope) => tsxFiles(scope))) {
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (fixedStatusColor.test(line)) offenders.push(`${relative(SRC, file)}:${index + 1}`)
    })
  }
  expect(offenders).toEqual([])
})
