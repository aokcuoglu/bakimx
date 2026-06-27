import { existsSync, mkdirSync, createWriteStream, createReadStream } from "node:fs"
import { createGzip, createGunzip } from "node:zlib"
import { createInterface } from "node:readline"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { mapBrand, mapModel, mapType, mapTypeDetail, type RawRow } from "../src/lib/catalog/row-mappers"

// Mirror prisma/seed.ts: load .env.local before reading DATABASE_URL.
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

const DATA_DIR = path.join(__dirname, "..", "prisma", "data", "vehicle-catalog")
const SOURCE_URL = process.env.CATALOG_SOURCE_URL || "postgresql://postgres@localhost:54322/getirbakim"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

type TableSpec = {
  file: string
  query: string
  table: "vehicleBrand" | "vehicleModel" | "vehicleType" | "vehicleTypeDetail"
  map: (row: RawRow) => Record<string, unknown>
}

const TABLES: TableSpec[] = [
  { file: "brands.ndjson.gz", table: "vehicleBrand", map: mapBrand,
    query: "SELECT id, name FROM v0.vbrands" },
  { file: "models.ndjson.gz", table: "vehicleModel", map: mapModel,
    query: "SELECT id, name, date_from, date_to, brand_id FROM v0.vmodels" },
  { file: "types.ndjson.gz", table: "vehicleType", map: mapType,
    query: "SELECT id, name, cc, fuel_type, hp, kwt, year_of_constr_from, year_of_constr_to, model_id FROM v0.vtypes" },
  { file: "type_details.ndjson.gz", table: "vehicleTypeDetail", map: mapTypeDetail,
    query: "SELECT id::text AS id, vehicle_type_id, brake_system, car_id, ccm_tech, construction_type, cylinder, cylinder_capacity_ccm, cylinder_capacity_liter, fuel_type, fuel_type_process, impulsion_type, manu_id, manu_name, mod_id, model_name, motor_type, power_hp_from, power_hp_to, power_kw_from, power_kw_to, type_name, type_number, valves, year_of_constr_from, year_of_constr_to, rmi_type_id, motor_codes, raw_payload, created_at::text AS created_at, updated_at::text AS updated_at FROM v0.vtype_details" },
]

// BigInt is not JSON-serializable for createMany result logging; mappers output it,
// but we only insert — never JSON.stringify a mapped row.
async function insertBatched(table: TableSpec["table"], rows: Record<string, unknown>[]) {
  const BATCH = 2000
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    // @ts-expect-error createMany input shape is validated by the mappers per table
    const res = await prisma[table].createMany({ data: slice, skipDuplicates: true })
    inserted += res.count
  }
  return inserted
}

async function readSource(): Promise<Record<string, RawRow[]>> {
  const src = new Pool({ connectionString: SOURCE_URL })
  try {
    const out: Record<string, RawRow[]> = {}
    for (const t of TABLES) {
      const { rows } = await src.query(t.query)
      out[t.file] = rows as RawRow[]
      console.log(`  read ${rows.length} rows for ${t.file}`)
    }
    return out
  } finally {
    await src.end()
  }
}

function writeSeedFile(file: string, rows: RawRow[]): Promise<void> {
  mkdirSync(DATA_DIR, { recursive: true })
  const gzip = createGzip()
  const out = createWriteStream(path.join(DATA_DIR, file))
  gzip.pipe(out)
  for (const row of rows) gzip.write(JSON.stringify(row) + "\n")
  gzip.end()
  return new Promise((resolve, reject) => { out.on("finish", resolve); out.on("error", reject) })
}

function readSeedFile(file: string): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const rows: RawRow[] = []
    const rl = createInterface({ input: createReadStream(path.join(DATA_DIR, file)).pipe(createGunzip()) })
    rl.on("line", (line) => { if (line.trim()) rows.push(JSON.parse(line) as RawRow) })
    rl.on("close", () => resolve(rows))
    rl.on("error", reject)
  })
}

async function main() {
  const mode = process.argv.includes("--from-db") ? "db"
    : process.argv.includes("--from-file") ? "file"
    : null
  if (!mode) {
    console.error("Usage: db:seed-catalog -- (--from-db | --from-file)")
    process.exit(1)
  }

  let source: Record<string, RawRow[]>
  if (mode === "db") {
    console.log(`Reading source ${SOURCE_URL} …`)
    source = await readSource()
    console.log("Writing seed files …")
    for (const t of TABLES) await writeSeedFile(t.file, source[t.file])
  } else {
    console.log(`Reading seed files from ${DATA_DIR} …`)
    source = {}
    for (const t of TABLES) {
      if (!existsSync(path.join(DATA_DIR, t.file))) {
        console.error(`Missing seed file: ${t.file}. Run with --from-db first.`)
        process.exit(1)
      }
      source[t.file] = await readSeedFile(t.file)
    }
  }

  // Insert in FK order: brands → models → types → details.
  for (const t of TABLES) {
    const mapped = source[t.file].map(t.map)
    const count = await insertBatched(t.table, mapped)
    console.log(`  ${t.table}: +${count} inserted (of ${mapped.length}, duplicates skipped)`)
  }
  console.log("Done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
