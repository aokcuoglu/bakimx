import type { PoolConfig } from "pg"

/**
 * Build the `pg` Pool config for a Postgres URL, applying the AWS RDS TLS workaround.
 *
 * AWS RDS presents an Amazon RDS CA that Node does not trust out of the box, and the pg
 * driver's newer default verifies the chain (`sslmode=require` now behaves like
 * `verify-full`), failing with "self-signed certificate in certificate chain". With
 * `DB_SSL_NO_VERIFY=true` the connection is still encrypted but the chain is not verified
 * (acceptable for the private, in-VPC RDS instances). Local dev leaves the flag unset and
 * puts `sslmode=no-verify` in the URL instead → the string is used unchanged.
 *
 * Kept dependency-free (type-only import) so scripts baked into the Docker `/migrate`
 * tree can reuse it without pulling in the Prisma client. Consumers: src/lib/db.ts,
 * prisma/seed.ts, scripts/migrate-vehicle-catalog.ts.
 */
export function buildPoolConfig(url: string): PoolConfig {
  if (process.env.DB_SSL_NO_VERIFY !== "true") return { connectionString: url }

  const connectionString = url
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/\?&/g, "?")
    .replace(/[?&]$/g, "")

  return { connectionString, ssl: { rejectUnauthorized: false } }
}
