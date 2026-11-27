import { existsSync } from "node:fs"
import path from "node:path"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { ORDER_TOTALS_ITEM_SELECT } from "../src/lib/totals"
import { computeStoredGrandTotal } from "../src/lib/orders/stored-total"

// Prisma 7 + tsx don't auto-load .env files (mirrors prisma.config.ts / seed.ts).
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, "..", envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

/**
 * `ServiceOrder.grandTotal` (saklanan genel toplam, #831) kolonunu mevcut iş
 * emirleri için doldurur.
 *
 * Neden migration'da değil: toplam, KDV'ye tabi satır oranlaması ve kuruş
 * yuvarlaması içeren TypeScript mantığıdır (`calculateOrderTotals`); SQL'de
 * ikinci bir kopyası sessizce ayrışırdı. Tek hesap kaynağı olarak aynı fonksiyon
 * (`computeStoredGrandTotal`) kullanılır.
 *
 * Usage (run from project root, against the target DB):
 *   bun run db:backfill-order-grand-total            # yazar
 *   bun run db:backfill-order-grand-total -- --dry-run
 *
 * Idempotent: yalnız değeri farklı olan satırı yazar; tekrar çalıştırmak 0 değişiklik verir.
 */

const DRY_RUN = process.argv.includes("--dry-run")
const BATCH = 500

const pool = new Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  let cursor: string | undefined
  let scanned = 0
  let changed = 0

  for (;;) {
    const orders = await prisma.serviceOrder.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        grandTotal: true,
        discountAmount: true,
        taxRate: true,
        items: { select: ORDER_TOTALS_ITEM_SELECT },
      },
    })
    if (orders.length === 0) break

    for (const order of orders) {
      const next = computeStoredGrandTotal(order.items, {
        discountAmount: order.discountAmount,
        taxRate: order.taxRate,
      })
      if (next === order.grandTotal) continue
      changed++
      if (!DRY_RUN) {
        await prisma.serviceOrder.update({ where: { id: order.id }, data: { grandTotal: next } })
      }
    }

    scanned += orders.length
    cursor = orders[orders.length - 1].id
  }

  console.log(`${DRY_RUN ? "[dry-run] güncellenecek" : "güncellendi"}: ${changed} / ${scanned} iş emri`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
