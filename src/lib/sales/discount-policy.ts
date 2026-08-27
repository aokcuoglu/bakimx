export type SalesDiscountFunding = "advisor_margin" | "bakimx_funded"

type DiscountAccess =
  | { kind: "admin"; userId: string; advisorId: null }
  | { kind: "advisor"; userId: string; advisorId: string }

type DiscountRequest = {
  fundingSource?: SalesDiscountFunding
  advisorId?: string
  leadId?: string
}

type LeadAssignment = { id: string; advisorId: string | null; status: string } | null

type DiscountAssignment = {
  fundingSource: SalesDiscountFunding
  advisorId: string
  leadId: string | null
  createdByUserId: string
}

type DiscountPolicyResult =
  | { ok: true; assignment: DiscountAssignment }
  | { ok: false; error: string }

/**
 * The funding source is derived from the caller boundary, not trusted from the
 * form. Advisors can only spend their own margin. Platform staff can only issue
 * BakımX-funded codes and must assign them to an active advisor.
 */
export function resolveSalesDiscountAssignment(
  access: DiscountAccess,
  request: DiscountRequest,
  lead: LeadAssignment,
): DiscountPolicyResult {
  if (request.leadId && !lead) {
    return { ok: false, error: "İndirim kodunun bağlanacağı aday bulunamadı." }
  }
  if (lead && ["won", "lost"].includes(lead.status)) {
    return { ok: false, error: "Kapanmış bir satış adayı için yeni kod oluşturulamaz." }
  }

  if (access.kind === "advisor") {
    if (request.fundingSource && request.fundingSource !== "advisor_margin") {
      return { ok: false, error: "BakımX destekli kodu yalnız yetkili yöneticiler oluşturabilir." }
    }
    if (request.advisorId && request.advisorId !== access.advisorId) {
      return { ok: false, error: "Kod yalnız kendi satış portföyünüze atanabilir." }
    }
    if (lead && lead.advisorId !== access.advisorId) {
      return { ok: false, error: "Bu satış adayı portföyünüzde değil." }
    }
    return {
      ok: true,
      assignment: {
        fundingSource: "advisor_margin",
        advisorId: access.advisorId,
        leadId: lead?.id ?? null,
        createdByUserId: access.userId,
      },
    }
  }

  if (request.fundingSource && request.fundingSource !== "bakimx_funded") {
    return { ok: false, error: "Yönetici tarafından verilen kod BakımX destekli olmalıdır." }
  }
  if (!request.advisorId) {
    return { ok: false, error: "BakımX destekli kod için bir satış danışmanı seçin." }
  }
  if (lead && lead.advisorId !== request.advisorId) {
    return { ok: false, error: "Seçilen aday bu satış danışmanına atanmamış." }
  }

  return {
    ok: true,
    assignment: {
      fundingSource: "bakimx_funded",
      advisorId: request.advisorId,
      leadId: lead?.id ?? null,
      createdByUserId: access.userId,
    },
  }
}

export function canManageSalesDiscountCode(
  access: Pick<DiscountAccess, "kind" | "advisorId">,
  code: { fundingSource: SalesDiscountFunding; advisorId: string | null },
): boolean {
  if (access.kind === "admin") return true
  return code.fundingSource === "advisor_margin" && code.advisorId === access.advisorId
}

export const SALES_DISCOUNT_FUNDING_LABELS: Record<SalesDiscountFunding, string> = {
  advisor_margin: "Danışman bütçeli",
  bakimx_funded: "BakımX destekli",
}
