"use server"

import { requireWritableWorkshop } from "@/lib/auth"

export type CreateAddonOrderInput = {
  items: { key: string; quantity: number }[]
  method?: string
  invoiceTitle: string
  taxNumber: string
  taxOffice?: string
}

export type CreateAddonOrderResult =
  | { ok: true; reference: string; amountMinor: number; method: "card" | "havale" }
  | { ok: false; error: string }

/** Fail-closed taslak (#829 P1): imza sabit, sipariş oluşturma sonraki dilimde. */
export async function createAddonOrder(_input: CreateAddonOrderInput): Promise<CreateAddonOrderResult> {
  await requireWritableWorkshop("billing.manage")
  return { ok: false, error: "Ek özellik satın alma henüz açık değil." }
}
