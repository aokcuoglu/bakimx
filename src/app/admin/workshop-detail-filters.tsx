"use client"

import { format, isValid, parse } from "date-fns"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { DateRangePicker, type DateRangeValue } from "@/components/ui/date-range-picker"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  BILLING_CYCLES,
  BILLING_ORDER_STATUSES,
  ORDER_FILTER_PARAMS,
  replaceWorkshopDetailFilterParams,
  USAGE_FILTER_PARAMS,
  WORKSHOP_PLAN_TIERS,
} from "@/lib/admin/workshop-detail-query"
import { typedResolver } from "@/lib/validations/resolver"
import {
  usageDateFilterSchema,
  workshopOrderFilterSchema,
  type UsageDateFilterValues,
  type WorkshopOrderFilterValues,
} from "@/lib/validations/workshop-detail-filters"

const STATUS_LABELS: Record<(typeof BILLING_ORDER_STATUSES)[number], string> = {
  pending_payment: "Ödeme bekliyor",
  confirmed: "Teyit edildi",
  cancelled: "İptal",
}

const PLAN_LABELS: Record<(typeof WORKSHOP_PLAN_TIERS)[number], string> = {
  lite: "Lite",
  starter: "Başlangıç",
  pro: "Profesyonel",
  premium: "Premium",
}

const CYCLE_LABELS: Record<(typeof BILLING_CYCLES)[number], string> = {
  monthly: "Aylık",
  yearly: "Yıllık",
}

function parseUrlDate(value: string): Date | undefined {
  if (!value) return undefined
  const date = parse(value, "yyyy-MM-dd", new Date())
  return isValid(date) ? date : undefined
}

function initialRange(from: string, to: string): DateRangeValue | undefined {
  const fromDate = parseUrlDate(from)
  const toDate = parseUrlDate(to)
  return fromDate || toDate ? { from: fromDate, to: toDate } : undefined
}

function dateParams(prefix: "" | "order", range: DateRangeValue | undefined): Record<string, string | undefined> {
  const fromKey = prefix ? "orderFrom" : "from"
  const toKey = prefix ? "orderTo" : "to"
  return {
    [fromKey]: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
    [toKey]: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
  }
}

function useFilterNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  return (
    keys: readonly string[],
    values: Readonly<Record<string, string | undefined>> = {},
  ) => {
    const query = replaceWorkshopDetailFilterParams(searchParams.toString(), keys, values)
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
}

export function UsageDateFilter({ from, to }: { from: string; to: string }) {
  const navigate = useFilterNavigation()
  const form = useForm<UsageDateFilterValues, unknown, UsageDateFilterValues>({
    resolver: typedResolver(usageDateFilterSchema),
    defaultValues: { range: initialRange(from, to) },
  })

  function submit(values: UsageDateFilterValues) {
    navigate(USAGE_FILTER_PARAMS, dateParams("", values.range))
  }

  function clear() {
    form.reset({ range: undefined })
    navigate(USAGE_FILTER_PARAMS)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
        <FormField
          control={form.control}
          name="range"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tarih aralığı</FormLabel>
              <FormControl>
                <DateRangePicker
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Tüm zamanlar"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap justify-end gap-2">
          {(from || to) && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Sıfırla
            </Button>
          )}
          <Button type="submit" size="sm">
            Uygula
          </Button>
        </div>
      </form>
    </Form>
  )
}

export interface WorkshopOrderFiltersProps {
  from: string
  to: string
  status: WorkshopOrderFilterValues["status"]
  plan: WorkshopOrderFilterValues["plan"]
  cycle: WorkshopOrderFilterValues["cycle"]
  hasFilters: boolean
}

export function WorkshopOrderFilters({
  from,
  to,
  status,
  plan,
  cycle,
  hasFilters,
}: WorkshopOrderFiltersProps) {
  const navigate = useFilterNavigation()
  const form = useForm<WorkshopOrderFilterValues, unknown, WorkshopOrderFilterValues>({
    resolver: typedResolver(workshopOrderFilterSchema),
    defaultValues: {
      range: initialRange(from, to),
      status,
      plan,
      cycle,
    },
  })

  function submit(values: WorkshopOrderFilterValues) {
    navigate(ORDER_FILTER_PARAMS, {
      ...dateParams("order", values.range),
      orderStatus: values.status || undefined,
      orderPlan: values.plan || undefined,
      orderCycle: values.cycle || undefined,
    })
  }

  function clear() {
    form.reset({ range: undefined, status: "", plan: "", cycle: "" })
    navigate(ORDER_FILTER_PARAMS)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FormField
            control={form.control}
            name="range"
            render={({ field }) => (
              <FormItem className="sm:col-span-2 xl:col-span-2">
                <FormLabel>Tarih aralığı</FormLabel>
                <FormControl>
                  <DateRangePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Tüm zamanlar"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Durum</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tüm durumlar" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Tüm durumlar</SelectItem>
                    {BILLING_ORDER_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="plan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Paket</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tüm paketler" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Tüm paketler</SelectItem>
                    {WORKSHOP_PLAN_TIERS.map((value) => (
                      <SelectItem key={value} value={value}>{PLAN_LABELS[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="cycle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Faturalama</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Tüm döngüler" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Tüm döngüler</SelectItem>
                    {BILLING_CYCLES.map((value) => (
                      <SelectItem key={value} value={value}>{CYCLE_LABELS[value]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Filtreleri temizle
            </Button>
          )}
          <Button type="submit" size="sm">
            Uygula
          </Button>
        </div>
      </form>
    </Form>
  )
}
