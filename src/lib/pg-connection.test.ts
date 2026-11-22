import { afterEach, expect, test } from "bun:test"
import {
  buildAppPoolConfig,
  buildPoolConfig,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_POOL_IDLE_TIMEOUT_MS,
  DEFAULT_QUERY_TIMEOUT_MS,
} from "@/lib/pg-connection"

const RDS_URL = "postgresql://u:p@db.eu-central-1.rds.amazonaws.com:5432/bakimx?sslmode=require"

afterEach(() => {
  delete process.env.DB_SSL_NO_VERIFY
  delete process.env.DB_CONNECT_TIMEOUT_MS
  delete process.env.DB_QUERY_TIMEOUT_MS
  delete process.env.DB_POOL_IDLE_TIMEOUT_MS
})

// ---------------------------------------------------------------------------
// Flag unset (local dev, legacy Contabo prod): connection string untouched
// ---------------------------------------------------------------------------

test("passes the URL through unchanged when DB_SSL_NO_VERIFY is not set", () => {
  expect(buildPoolConfig(RDS_URL).connectionString).toBe(RDS_URL)
  expect(buildPoolConfig(RDS_URL).ssl).toBeUndefined()
})

test("only 'true' enables the workaround", () => {
  process.env.DB_SSL_NO_VERIFY = "1"
  expect(buildPoolConfig(RDS_URL).connectionString).toBe(RDS_URL)
  expect(buildPoolConfig(RDS_URL).ssl).toBeUndefined()
})

// ---------------------------------------------------------------------------
// Flag on (AWS dev/prod): strip sslmode, stop verifying the RDS CA chain.
// Leaving sslmode=require in place made pg verify the chain (verify-full
// semantics) and fail with "self-signed certificate in certificate chain".
// ---------------------------------------------------------------------------

test("strips sslmode and disables chain verification when DB_SSL_NO_VERIFY=true", () => {
  process.env.DB_SSL_NO_VERIFY = "true"
  expect(buildPoolConfig(RDS_URL)).toMatchObject({
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

// ---------------------------------------------------------------------------
// Liveness: never wait forever on a socket that accepts but never answers.
//
// Local dev reaches the AWS dev database through an SSM port-forward. When that
// session dies, localhost:5433 keeps LISTENing (session-manager-plugin holds
// the socket) while no byte ever flows. With pg's defaults
// (connectionTimeoutMillis: 0, keepAlive: false) every query then hangs
// forever — the login POST never answers and the UI spins indefinitely.
// ---------------------------------------------------------------------------

test("every pool bounds connection acquisition and enables TCP keepalive", () => {
  const cfg = buildPoolConfig(RDS_URL)
  expect(cfg.connectionTimeoutMillis).toBe(DEFAULT_CONNECT_TIMEOUT_MS)
  expect(cfg.connectionTimeoutMillis).toBeGreaterThan(0)
  expect(cfg.keepAlive).toBe(true)
})

test("connect timeout is tunable via DB_CONNECT_TIMEOUT_MS", () => {
  process.env.DB_CONNECT_TIMEOUT_MS = "2500"
  expect(buildPoolConfig(RDS_URL).connectionTimeoutMillis).toBe(2500)
})

test("a non-numeric or non-positive override falls back to the default", () => {
  process.env.DB_CONNECT_TIMEOUT_MS = "sonsuz"
  expect(buildPoolConfig(RDS_URL).connectionTimeoutMillis).toBe(DEFAULT_CONNECT_TIMEOUT_MS)
  process.env.DB_CONNECT_TIMEOUT_MS = "0"
  expect(buildPoolConfig(RDS_URL).connectionTimeoutMillis).toBe(DEFAULT_CONNECT_TIMEOUT_MS)
})

// ---------------------------------------------------------------------------
// Query timeouts are request-shaped, so they apply to the application pool
// only. Long-running maintenance scripts (prisma/seed.ts, the vehicle-catalog
// migration, prod-reset) build their pool from buildPoolConfig and must keep
// running past any per-request budget.
// ---------------------------------------------------------------------------

test("the application pool bounds query duration on both client and server", () => {
  const cfg = buildAppPoolConfig(RDS_URL)
  expect(cfg.query_timeout).toBe(DEFAULT_QUERY_TIMEOUT_MS)
  expect(cfg.statement_timeout).toBe(DEFAULT_QUERY_TIMEOUT_MS)
})

test("the application pool keeps the base TLS and connect behaviour", () => {
  process.env.DB_SSL_NO_VERIFY = "true"
  const cfg = buildAppPoolConfig(RDS_URL)
  expect(cfg.ssl).toEqual({ rejectUnauthorized: false })
  expect(cfg.connectionString).toBe("postgresql://u:p@db.eu-central-1.rds.amazonaws.com:5432/bakimx")
  expect(cfg.connectionTimeoutMillis).toBe(DEFAULT_CONNECT_TIMEOUT_MS)
})

test("query timeout is tunable via DB_QUERY_TIMEOUT_MS", () => {
  process.env.DB_QUERY_TIMEOUT_MS = "45000"
  expect(buildAppPoolConfig(RDS_URL).query_timeout).toBe(45000)
  expect(buildAppPoolConfig(RDS_URL).statement_timeout).toBe(45000)
})

test("script pools stay unbounded so long backfills are not cut off", () => {
  const cfg = buildPoolConfig(RDS_URL)
  expect(cfg.query_timeout).toBeUndefined()
  expect(cfg.statement_timeout).toBeUndefined()
})

// ---------------------------------------------------------------------------
// Idle connections are kept warm in the application pool. pg's default (10 s)
// emptied the pool whenever a user read a page for longer than that, so the
// next click re-opened every connection from scratch (TCP + TLS + SCRAM):
// ~550 ms each through the dev SSM tunnel, /orders 0.85 s → 2.6 s after idle.
// ---------------------------------------------------------------------------

test("the application pool keeps idle connections for minutes, not pg's 10 s", () => {
  const cfg = buildAppPoolConfig(RDS_URL)
  expect(cfg.idleTimeoutMillis).toBe(DEFAULT_POOL_IDLE_TIMEOUT_MS)
  expect(DEFAULT_POOL_IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000)
})

test("idle connections never keep a process alive on their own", () => {
  // A script that imports the app client and forgets $disconnect must not hang
  // for the whole idle window; the Next server stays alive via its HTTP listener.
  expect(buildAppPoolConfig(RDS_URL).allowExitOnIdle).toBe(true)
})

test("idle timeout is tunable via DB_POOL_IDLE_TIMEOUT_MS", () => {
  process.env.DB_POOL_IDLE_TIMEOUT_MS = "15000"
  expect(buildAppPoolConfig(RDS_URL).idleTimeoutMillis).toBe(15000)
  process.env.DB_POOL_IDLE_TIMEOUT_MS = "hep"
  expect(buildAppPoolConfig(RDS_URL).idleTimeoutMillis).toBe(DEFAULT_POOL_IDLE_TIMEOUT_MS)
})

test("script pools keep pg's idle default", () => {
  expect(buildPoolConfig(RDS_URL).idleTimeoutMillis).toBeUndefined()
})
