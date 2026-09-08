/** #626 integration acceptance. Refuses every DB except the disposable local test DB. */
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
const url = new URL(process.env.DATABASE_URL || "postgres://invalid")
assert.equal(url.hostname, "localhost")
assert.equal(url.port, "55432")
assert.equal(url.pathname, "/bakimx_lite_626")
process.env.RATE_LIMIT_STORE = "memory"
const { prisma } = await import("../../src/lib/db")
const { resetRateLimitStateForTests } = await import("../../src/lib/rate-limit")
const { POST: register } = await import("../../src/app/api/auth/register/route")
const { POST: checkout } = await import("../../src/app/api/checkout/route")
const { activateVerifiedWorkshop } = await import("../../src/lib/billing/verify-activation")
const { getPlanPriceMinor } = await import("../../src/lib/billing/pricing")
const { getPlanState } = await import("../../src/lib/plan")
const suffix = Date.now()
const body = { password: "qa-password-626", firstName: "Test", lastName: "Fixture", workshopName: "QA Lite 626", phone: "05550000626", city: "İstanbul", address: "QA fixture", taxNumber: "1234567890", invoiceTitle: "QA fixture", kvkkConsent: true, acquisitionSource: "website" }
const request = (extra: object) => new Request("http://localhost/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, ...extra }) })
async function find(email: string) { const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { workshop: true } }); return user.workshop }
process.env.LITE_REGISTRATION_OPEN = "true"
const email = `lite-${suffix}@example.test`
assert.equal((await register(request({ email, planTier: "lite" }))).status, 200)
let lite = await find(email)
assert.equal(lite.planTier, "lite"); assert.ok(lite.liteFreeGrantedAt); assert.equal(lite.trialEndsAt, null); assert.equal(lite.subscriptionStatus, "active")
assert.equal(await prisma.billingOrder.count({ where: { workshopId: lite.id } }), 0)
assert.equal(await prisma.paymentTransaction.count({ where: { workshopId: lite.id } }), 0)
process.env.LITE_REGISTRATION_OPEN = "false"
assert.equal((await register(request({ email, planTier: "lite" }))).status, 200) // authenticated resume
assert.deepEqual(await activateVerifiedWorkshop(lite.id), { ok: true })
assert.deepEqual(await activateVerifiedWorkshop(lite.id), { ok: true })
lite = await find(email)
assert.equal(lite.trialStartedAt, null); assert.equal(lite.currentPeriodEnd, null); assert.equal(getPlanState(lite).canWrite, true); assert.equal(getPlanState(lite).accessTier, "lite")
assert.equal((await register(request({ email: `closed-${suffix}@example.test`, planTier: "lite", liteFreeGrantedAt: new Date() }))).status, 409)
assert.equal((await checkout(request({ email: `checkout-${suffix}@example.test`, tier: "lite", cycle: "monthly", loginCode: "qa-lite-626" }))).status, 409)
assert.equal((await register(request({ email: `forged-${suffix}@example.test`, planTier: "starter" }))).status, 400)
const paidEmail = `paid-${suffix}@example.test`
assert.equal((await register(request({ email: paidEmail, planTier: "premium" }))).status, 200)
resetRateLimitStateForTests()
const mismatch = await register(request({ email: paidEmail, planTier: "lite" }))
assert.equal(mismatch.status, 409)
assert.equal((await mismatch.json()).code, "registration_plan_mismatch")
let paid = await find(paidEmail)
assert.equal(paid.liteFreeGrantedAt, null)
await activateVerifiedWorkshop(paid.id)
paid = await find(paidEmail)
assert.equal(paid.subscriptionStatus, "trialing"); assert.ok(paid.trialEndsAt); assert.equal(getPlanState(paid).accessTier, "premium")
const paidCheckoutEmail = `paid-checkout-${suffix}@example.test`
const paidCheckoutResponse = await checkout(request({ email: paidCheckoutEmail, tier: "pro", cycle: "monthly", loginCode: "qa-paid-626" }))
assert.equal(paidCheckoutResponse.status, 200)
const paidCheckoutBody = await paidCheckoutResponse.json()
assert.equal(paidCheckoutBody.complimentary, false)
assert.equal(paidCheckoutBody.amountMinor, getPlanPriceMinor("pro", "monthly"))
const paidCheckoutWorkshop = await find(paidCheckoutEmail)
assert.equal(paidCheckoutWorkshop.subscriptionStatus, "trialing")
assert.equal(paidCheckoutWorkshop.liteFreeGrantedAt, null)
assert.equal(await prisma.billingOrder.count({ where: { workshopId: paidCheckoutWorkshop.id, status: "pending_payment" } }), 1)
// Next HTTP path also executes real post-commit audit and activation, unlike CLI's server-only push environment.
const qaBaseUrl = process.env.QA_BASE_URL || "http://localhost:3026"
assert.equal(new URL(qaBaseUrl).hostname, "localhost")
const httpEmail = `http-lite-${suffix}@example.test`
const httpCheckout = await fetch(`${qaBaseUrl}/api/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, email: httpEmail, tier: "lite", cycle: "yearly", loginCode: "qa-http-626" }) })
assert.equal(httpCheckout.status, 200, await httpCheckout.clone().text())
assert.equal((await httpCheckout.json()).complimentary, true)
const httpLite = await find(httpEmail)
assert.equal(httpLite.planTier, "lite"); assert.ok(httpLite.liteFreeGrantedAt)
assert.equal(httpLite.currentPeriodEnd, null); assert.equal(httpLite.trialEndsAt, null); assert.equal(httpLite.trialStartedAt, null)
assert.equal(await prisma.billingOrder.count({ where: { workshopId: httpLite.id, status: "confirmed", amountMinor: 0, periodEnd: null } }), 1)
assert.equal(await prisma.paymentTransaction.count({ where: { workshopId: httpLite.id } }), 0)
// Synthetic sandbox card only: stale free orders must never enter payment processing.
const zeroReference = `QA-ZERO-${suffix}`
const zeroOrder = await prisma.billingOrder.create({ data: { workshopId: httpLite.id, type: "renewal", planTier: "lite", billingCycle: "monthly", amountMinor: 0, grossAmountMinor: 0, netAmountMinor: 0, reference: zeroReference, status: "pending_payment", method: "card" } })
const syntheticCard = new FormData()
for (const [key, value] of Object.entries({ reference: zeroReference, holderName: "QA SYNTHETIC CARD", number: "4111111111111111", expireMonth: "12", expireYear: String(new Date().getFullYear() + 2), cvv: "123" })) syntheticCard.set(key, value)
const zeroInitiate = await fetch(`${qaBaseUrl}/api/payments/tami/initiate`, { method: "POST", body: syntheticCard, redirect: "manual" })
assert.equal(zeroInitiate.status, 303)
assert.equal(new URL(zeroInitiate.headers.get("location")!).searchParams.get("err"), null) // passed rate/card validation
// A transaction is created before the provider call; its absence proves neither occurred.
assert.equal(await prisma.paymentTransaction.count({ where: { billingOrderId: zeroOrder.id } }), 0)
assert.equal((await prisma.billingOrder.findUniqueOrThrow({ where: { id: zeroOrder.id } })).status, "pending_payment")
// Legacy backfill: free Lite repaired, paid Lite and paid Pro never made free.
const freeLegacy = await prisma.workshop.create({ data: { loginCode: `qaf-${suffix}`, phone: body.phone, city: body.city, address: body.address, name: "QA free legacy", planTier: "lite", approvalStatus: "approved", currentPeriodEnd: new Date(0) } })
const paidLegacy = await prisma.workshop.create({ data: { loginCode: `qap-${suffix}`, phone: body.phone, city: body.city, address: body.address, name: "QA paid legacy", planTier: "lite", approvalStatus: "approved" } })
await prisma.billingOrder.create({ data: { workshopId: paidLegacy.id, type: "new_purchase", planTier: "lite", billingCycle: "monthly", amountMinor: 49900, grossAmountMinor: 49900, netAmountMinor: 41583, reference: `QA-${suffix}`, status: "confirmed" } })
const sql = await readFile(new URL("../../prisma/migrations/20260908120000_lite_lifetime_campaign/migration.sql", import.meta.url), "utf8")
for (let run = 0; run < 2; run++) for (const statement of sql.split(";").filter(s => s.trim())) await prisma.$executeRawUnsafe(statement)
assert.ok((await prisma.workshop.findUniqueOrThrow({ where: { id: freeLegacy.id } })).liteFreeGrantedAt)
assert.equal((await prisma.workshop.findUniqueOrThrow({ where: { id: paidLegacy.id } })).liteFreeGrantedAt, null)
assert.equal((await find(paidEmail)).liteFreeGrantedAt, null)
console.log("PASS #626: real DB register, closed/resume, email activation replay, no trial/payment, paid trial/checkout, HTTP free activation, zero-card-initiation guard, API bypass and idempotent conservative backfill")
await prisma.$disconnect()
