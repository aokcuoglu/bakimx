import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "prisma/config"

// Prisma 7 no longer auto-loads .env files, and the CLI runs in a Node subprocess that does
// not inherit Next.js's env loading. Load .env.local then .env (Next.js precedence) so
// DIRECT_URL/DATABASE_URL resolve for `prisma migrate`/`studio`/`db push`. loadEnvFile never
// overrides vars already set in the real environment → prod/CI (real env, no files) untouched.
if (typeof process.loadEnvFile === "function") {
  for (const envFile of [".env.local", ".env"]) {
    const envPath = path.join(__dirname, envFile)
    if (existsSync(envPath)) process.loadEnvFile(envPath)
  }
}

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  },
})