"use client"

import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function CreditPeriodSelect({ value, periods }: { value: string; periods: { value: string; label: string }[] }) {
  const router = useRouter()
  return <Select value={value} onValueChange={(next) => router.push(`/settings/billing/automation-credit-usage?period=${next}`)}>
    <SelectTrigger size="sm" aria-label="Kredi kullanım dönemi"><SelectValue /></SelectTrigger>
    <SelectContent>{periods.map((period) => <SelectItem key={period.value} value={period.value}>{period.label}</SelectItem>)}</SelectContent>
  </Select>
}
