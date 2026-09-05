import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { demoQuotaKeys, reserveDemoQuota } from "./demo-quota";

// Opt-in PostgreSQL proof; only uniquely namespaced test counters are created/deleted.
test.skipIf(process.env.DEMO_OCR_DB_TESTS !== "true")(
  "PostgreSQL serializes concurrent reservations across browser, IP and global limits",
  async () => {
    const run = randomUUID();
    const ownedKeys = new Set<string>();
    try {
      for (const scenario of ["browser", "ip", "global"] as const) {
        const requests = Array.from({ length: 6 }, (_, index) => {
          const browser = scenario === "browser" ? "shared" : String(index);
          const ip = scenario === "ip" ? "shared" : String(index);
          const keys = demoQuotaKeys(`${run}:${scenario}:${browser}`, `${run}:${scenario}:${ip}`, "demo-ocr-integration-test");
          keys.globalKey = `demo-ocr:test:${run}:${scenario}:global`;
          Object.values(keys).forEach(key => ownedKeys.add(key));
          return reserveDemoQuota(keys, scenario === "global" ? 2 : 50);
        });
        const results = await Promise.allSettled(requests);
        expect(results.filter(result => result.status === "fulfilled")).toHaveLength(scenario === "global" ? 2 : 1);
        for (const result of results) {
          if (result.status === "rejected") expect(result.reason.code).toBe(scenario === "browser" ? "used" : "limited");
        }
      }
    } finally {
      await prisma.rateLimitCounter.deleteMany({ where: { key: { in: [...ownedKeys] } } });
    }
  },
  30_000,
);
