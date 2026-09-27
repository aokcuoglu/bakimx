import { randomBytes } from "node:crypto"
import { prisma } from "@/lib/db"
import { isUniqueConstraintError } from "@/lib/prisma-errors"

type ReferralCodeStore = {
  findUnique(args: { where: { id: string }; select: { referralCode: true } }): Promise<{ referralCode: string | null } | null>
  updateMany(args: { where: { id: string; referralCode: null }; data: { referralCode: string } }): Promise<{ count: number }>
}

/** Assign once per workshop. The conditional update makes concurrent page loads share one code. */
export async function getOrCreateWorkshopReferralCode(
  workshopId: string,
  store: ReferralCodeStore = prisma.workshop,
  makeCode: () => string = () => `BX-${randomBytes(8).toString("hex").toUpperCase()}`,
): Promise<string | null> {
  const workshop = await store.findUnique({ where: { id: workshopId }, select: { referralCode: true } })
  if (!workshop || workshop.referralCode) return workshop?.referralCode ?? null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = makeCode()
    try {
      const result = await store.updateMany({
        where: { id: workshopId, referralCode: null },
        data: { referralCode: code },
      })
      if (result.count === 1) return code
      const assigned = await store.findUnique({ where: { id: workshopId }, select: { referralCode: true } })
      return assigned?.referralCode ?? null
    } catch (error) {
      if (!isUniqueConstraintError(error, "referralcode")) throw error
    }
  }

  throw new Error("Could not assign a unique workshop referral code")
}
