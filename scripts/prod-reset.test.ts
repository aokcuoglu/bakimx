import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"
import { TENANT_TABLES, KEEP_TABLES } from "./prod-reset"

/**
 * Şemaya yeni bir model eklenip bu listelere yazılmazsa reset onu atlar: prod
 * "sıfırlandı" sanılır ama kiracı verisi tabloda kalır. Sessiz kalmasın diye
 * şema ile listeleri karşılaştırıyoruz.
 */
function schemaTables(): string[] {
  const schema = readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8")
  const tables: string[] = []
  for (const m of schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const mapped = m[2].match(/@@map\("([^"]+)"\)/)
    tables.push(mapped ? mapped[1] : m[1])
  }
  return tables
}

test("şemadaki her tablo ya siliniyor ya da korunuyor olarak sınıflandırılmış", () => {
  const classified = new Set([...TENANT_TABLES, ...KEEP_TABLES])
  const unclassified = schemaTables().filter((t) => !classified.has(t))
  expect(unclassified).toEqual([])
})

test("bir tablo iki listede birden olamaz", () => {
  const keep = new Set(KEEP_TABLES)
  expect(TENANT_TABLES.filter((t) => keep.has(t))).toEqual([])
})

test("katalog ve migration tabloları korunanlarda", () => {
  for (const t of ["vehicle_brands", "vehicle_models", "vehicle_types", "vehicle_type_details", "_prisma_migrations"]) {
    expect(KEEP_TABLES).toContain(t)
  }
})
