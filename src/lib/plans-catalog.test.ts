import { expect, test } from "bun:test"
import { PLAN_PACKAGES, getPlanPackage } from "@/lib/plans-catalog"

test("satış kataloğu üç güncel paketi doğru sırada sunar", () => {
  expect(PLAN_PACKAGES.map((plan) => plan.tier)).toEqual(["lite", "pro", "premium"])
})

test("Lite açılış kampanyası normal fiyatı koruyup ücretsiz satış fiyatı sunar", () => {
  const lite = getPlanPackage("lite")
  expect(lite?.monthlyPrice).toBe(0)
  expect(lite?.yearlyPrice).toBe(0)
  expect(lite && "listMonthlyLabel" in lite ? lite.listMonthlyLabel : undefined).toBe("₺499/ay")
})

test("birleşik Profesyonel ve Premium fiyatları yıllık iki ay bedava kuralına uyar", () => {
  const pro = getPlanPackage("pro")
  const premium = getPlanPackage("premium")
  expect(pro?.monthlyPrice).toBe(1799)
  expect(pro?.yearlyPrice).toBe(17990)
  expect(premium?.monthlyPrice).toBe(2999)
  expect(premium?.yearlyPrice).toBe(29990)
})

test("eski Başlangıç kayıtları okunabilir fakat satış kataloğunda yer almaz", () => {
  expect(getPlanPackage("starter")?.name).toBe("Başlangıç (eski)")
  expect(PLAN_PACKAGES.some((plan) => plan.tier === ("starter" as never))).toBe(false)
})
