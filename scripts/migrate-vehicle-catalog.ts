import { existsSync, mkdirSync, createWriteStream } from "node:fs"
import { createGzip } from "node:zlib"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { mapBrand, mapModel, mapType, mapTypeDetail, type RawRow } from "../src/lib/catalog/row-mappers"
import { streamNdjsonBatches } from "../src/lib/catalog/ndjson-stream"
import { buildPoolConfig } from "../src/lib/pg-connection"

// Mirror prisma/seed.ts: load .env.local before reading DATABASE_URL.
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

const DATA_DIR = path.join(__dirname, "..", "prisma", "data", "vehicle-catalog")
const SOURCE_URL = process.env.CATALOG_SOURCE_URL || "postgresql://postgres@localhost:54322/getirbakim"

// buildPoolConfig applies the RDS TLS workaround (DB_SSL_NO_VERIFY) exactly like src/lib/db.ts.
// Without it this script died in the deploy pipeline's one-off ECS task with
// "self-signed certificate in certificate chain" (P1011) on the first createMany.
const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL ?? ""))
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

// Prisma's client engine holds on to memory across createMany calls, so peak RSS tracks the
// batch size. Measured locally over the real fixtures (37.9k wide type_details rows):
// batch 2000 → 1662 MB, batch 500 → 1179 MB, batch 100 → 675 MB, all at the same ~13 s runtime.
// 500 buys ~500 MB of headroom for free; the deploy workflows size the one-off seed task to
// 2048 MB to cover the rest (a 512 MB task was OOM-killed at exit 137).
const BATCH = 500

// Stream one gz fixture straight into createMany batches. Nothing but the current batch is
// held in memory — buffering whole files is what OOM-killed the 512 MB seed task (exit 137).
// BigInt is not JSON-serializable for createMany result logging; mappers output it,
// but we only insert — never JSON.stringify a mapped row.
async function insertFromSeedFile(t: TableSpec) {
  let inserted = 0
  const total = await streamNdjsonBatches<RawRow>(path.join(DATA_DIR, t.file), BATCH, async (rows) => {
    // @ts-expect-error createMany input shape is validated by the mappers per table
    const res = await prisma[t.table].createMany({ data: rows.map(t.map), skipDuplicates: true })
    inserted += res.count
  })
  console.log(`  ${t.table}: +${inserted} inserted (of ${total}, duplicates skipped)`)
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

async function main() {
  const mode = process.argv.includes("--from-db") ? "db"
    : process.argv.includes("--from-file") ? "file"
    : null
  if (!mode) {
    console.error("Usage: db:seed-catalog -- (--from-db | --from-file)")
    process.exit(1)
  }

  if (mode === "db") {
    console.log(`Reading source ${SOURCE_URL} …`)
    const source = await readSource()
    console.log("Writing seed files …")
    for (const t of TABLES) await writeSeedFile(t.file, source[t.file])
  } else {
    console.log(`Reading seed files from ${DATA_DIR} …`)
    for (const t of TABLES) {
      if (!existsSync(path.join(DATA_DIR, t.file))) {
        console.error(`Missing seed file: ${t.file}. Run with --from-db first.`)
        process.exit(1)
      }
    }
  }

  // Insert in FK order: brands → models → types → details. Both modes read back from the gz
  // fixtures (--from-db has just written them), so the insert path is identical and streamed.
  for (const t of TABLES) await insertFromSeedFile(t)
  console.log("Done.")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
