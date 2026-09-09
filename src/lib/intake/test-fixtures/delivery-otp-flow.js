import { mock } from "bun:test";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
let mode = true, sendSuccess = true, consent = true, found = true, sentCode = "", sendCount = 0;
let status = "ready_for_delivery";
let approval = null;
const intake = () => found ? { id: "intake", status, customer: { phone: "5423681438", whatsappConsent: consent }, vehicle: { plate: "TEST" } } : null;
const prisma = {
  vehicleIntakeForm: { findFirst: async ({ where }) => {
    assert.equal(where.workshopId, "tenant");
    return intake();
  }, updateMany: async () => {
    status = "delivered";
    return { count: 1 };
  } },
  serviceOrder: { findFirst: async () => null },
  approvalRequest: {
    create: async ({ data }) => {
      approval = { ...data, id: "approval", createdAt: new Date };
      return approval;
    },
    updateMany: async ({ data }) => {
      if (approval)
        Object.assign(approval, data);
      return { count: 1 };
    },
    findFirst: async () => approval
  },
  $transaction: async (fn) => fn(prisma)
};
mock.module("@/lib/db", () => ({ prisma }));
mock.module("@/lib/auth", () => ({ getCurrentUserWithWorkshop: async () => ({ user: { id: "user", workshopId: "tenant" }, workshop: {} }) }));
mock.module("@/lib/plan", () => ({ PlanWriteLockedError: class extends Error {
}, getPlanState: () => ({ canWrite: true }) }));
mock.module("@/lib/audit", () => ({ AuditLogAction: async () => {} }));
mock.module("@/lib/intake/timeline", () => ({ addTimelineEvent: async () => {} }));
mock.module("@/lib/rbac", () => ({ assertCan: (_user, permission) => assert.equal(permission, "order.status") }));
mock.module("@/lib/communications/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }), recordAttempt: () => {} }));
mock.module("@/lib/communications/whatsapp/otp", () => ({ isMockWhatsAppOtp: () => mode, sendWhatsAppOtp: async (_to, code) => {
  sentCode = code;
  sendCount++;
  return { success: sendSuccess };
} }));
mock.module("@/app/(app)/orders/actions", () => ({ updateOrderStatusAction: async () => {} }));
const { requestDeliveryOtpAction: request, verifyDeliveryOtpAction: verify } = await import("../../../app/(app)/intakes/delivery-actions");
const demo = await request("intake");
assert.equal(demo.otpCode, sentCode);
assert.equal(approval?.otpCode, createHash("sha256").update(sentCode).digest("hex"));
assert.ok((await verify("intake", "invalid")).error);
assert.equal(status, "ready_for_delivery");
assert.equal((await verify("intake", sentCode)).success, true);
assert.equal(status, "delivered");
status = "ready_for_delivery";
mode = false;
const real = await request("intake");
assert.equal(real.success, true);
assert.equal(real.otpCode, undefined);
sendSuccess = false;
assert.ok((await request("intake")).error);
assert.ok((await verify("intake", sentCode)).error);
assert.equal(status, "ready_for_delivery");
const before = sendCount;
consent = false;
assert.ok((await request("intake")).error);
assert.equal(sendCount, before);
consent = true;
found = false;
assert.ok((await request("intake")).error);
assert.equal(sendCount, before);
console.log("delivery flow passed: mock, real redaction, hash, wrong code, delivery, failure, consent, tenant");
