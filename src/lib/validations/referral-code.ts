import { z } from "zod/v4"
import {
  isValidReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_MAX_LENGTH,
  REFERRAL_CODE_MIN_LENGTH,
} from "@/lib/referral-code"

export const optionalReferralCodeSchema = z
  .string()
  .optional()
  .default("")
  .transform(normalizeReferralCode)
  .refine(
    (code) => code === "" || isValidReferralCode(code),
    `Referans kodu ${REFERRAL_CODE_MIN_LENGTH}-${REFERRAL_CODE_MAX_LENGTH} karakter olmalı; yalnızca harf, rakam ve tire içermelidir`,
  )
