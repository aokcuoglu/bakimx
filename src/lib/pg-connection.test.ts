import { afterEach, expect, test } from "bun:test"
import { buildPoolConfig } from "@/lib/pg-connection"

const RDS_URL = "postgresql://u:p@db.eu-central-1.rds.amazonaws.com:5432/bakimx?sslmode=require"

afterEach(() => {
  delete process.env.DB_SSL_NO_VERIFY
})

// ---------------------------------------------------------------------------
// Flag unset (local dev, legacy Contabo prod): connection string untouched
// ---------------------------------------------------------------------------

test("passes the URL through unchanged when DB_SSL_NO_VERIFY is not set", () => {
  expect(buildPoolConfig(RDS_URL)).toEqual({ connectionString: RDS_URL })
})

test("only 'true' enables the workaround", () => {
  process.env.DB_SSL_NO_VERIFY = "1"
  expect(buildPoolConfig(RDS_URL)).toEqual({ connectionString: RDS_URL })
})

// ---------------------------------------------------------------------------
// Flag on (AWS dev/prod): strip sslmode, stop verifying the RDS CA chain.
// Leaving sslmode=require in place made pg verify the chain (verify-full
// semantics) and fail with "self-signed certificate in certificate chain".
// ---------------------------------------------------------------------------

test("strips sslmode and disables chain verification when DB_SSL_NO_VERIFY=true", () => {
  process.env.DB_SSL_NO_VERIFY = "true"
  expect(buildPoolConfig(RDS_URL)).toEqual({
    connectionString: "postgresql://u:p@db.eu-central-1.rds.amazonaws.com:5432/bakimx",
    ssl: { rejectUnauthorized: false },
  })
})

test("keeps other query params and leaves no dangling separator", () => {
  process.env.DB_SSL_NO_VERIFY = "true"
  const cfg = buildPoolConfig(`${RDS_URL}&connection_limit=5`)
  expect(cfg.connectionString).toBe(
    "postgresql://u:p@db.eu-central-1.rds.amazonaws.com:5432/bakimx?connection_limit=5",
  )
})

test("handles a URL with no query string", () => {
  process.env.DB_SSL_NO_VERIFY = "true"
  const cfg = buildPoolConfig("postgresql://u:p@host:5432/bakimx")
  expect(cfg.connectionString).toBe("postgresql://u:p@host:5432/bakimx")
  expect(cfg.ssl).toEqual({ rejectUnauthorized: false })
})
