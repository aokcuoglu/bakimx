import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { buildPoolConfig } from "../src/lib/pg-connection"

const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL ?? ""))
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const workshops = await prisma.workshop.findMany({
    where: { name: "KIZILDAĞ OTO" },
    select: { id: true },
  })

  if (workshops.length !== 1) {
    throw new Error(`pilot_workshop_count:${workshops.length}`)
  }

  const where = {
    workshopId_featureKey: {
      workshopId: workshops[0].id,
      featureKey: "getirbakimCatalog",
    },
  }
  const override = await prisma.workshopFeatureOverride.findUnique({
    where,
    select: { enabled: true, expiresAt: true },
  })

  if (!override) throw new Error("pilot_override_missing")
  if (override.expiresAt && override.expiresAt <= new Date()) {
    throw new Error("pilot_override_expired")
  }

  await prisma.workshopFeatureOverride.update({
    where,
    data: {
      enabled: true,
      reason: "BAK-184 Stage 2A quote-only pilot",
    },
  })

  console.log("stage2a_pilot_override=enabled")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
