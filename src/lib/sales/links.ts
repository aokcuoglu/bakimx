export function salesLeadAnchorId(leadId: string): string {
  return `sales-lead-${leadId}`
}

export function salesLeadAdminHref(leadId: string): string {
  return `/admin/sales/leads/${encodeURIComponent(leadId)}`
}

export function workshopAdminHref(workshopId: string): string {
  return `/admin/workshops/${encodeURIComponent(workshopId)}`
}

export function salesAdvisorDisplayName(user: {
  firstName: string | null
  lastName: string | null
  email: string | null
}): string | null {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
}
