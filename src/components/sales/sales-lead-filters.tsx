"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { salesLeadFilterSchema } from "@/lib/validations/sales"

export type SalesLeadFilterValues = {
  q: string
  status: "all" | "new" | "contacted" | "demo_scheduled" | "demo_completed" | "proposal" | "onboarding" | "won" | "lost"
  follow: "all" | "overdue" | "today" | "upcoming" | "none"
  advisorId: string
  createdFrom: string
  createdTo: string
}

const STATUS_OPTIONS = [
  ["all", "Tüm aşamalar"],
  ["new", "Yeni"],
  ["contacted", "İletişim"],
  ["demo_scheduled", "Demo planlandı"],
  ["demo_completed", "Demo yapıldı"],
  ["proposal", "Teklif"],
  ["onboarding", "Kayıt aşamasında"],
  ["won", "Kazanıldı"],
  ["lost", "Kaybedildi"],
] as const

const FOLLOW_OPTIONS = [
  ["all", "Tüm takipler"],
  ["overdue", "Geciken"],
  ["today", "Bugün"],
  ["upcoming", "Yaklaşan"],
  ["none", "Takipsiz"],
] as const

export function SalesLeadFilters({
  initialValues,
  advisors,
}: {
  initialValues: SalesLeadFilterValues
  advisors: { id: string; name: string }[]
}) {
  const router = useRouter()
  const form = useForm<SalesLeadFilterValues>({
    resolver: zodResolver(salesLeadFilterSchema),
    defaultValues: initialValues,
  })

  function submit(values: SalesLeadFilterValues) {
    const query = new URLSearchParams()
    if (values.q) query.set("q", values.q)
    if (values.status !== "all") query.set("status", values.status)
    if (values.follow !== "all") query.set("follow", values.follow)
    if (values.advisorId !== "all") query.set("advisorId", values.advisorId)
    if (values.createdFrom) query.set("createdFrom", values.createdFrom)
    if (values.createdTo) query.set("createdTo", values.createdTo)
    const search = query.toString()
    router.push(search ? `/admin/sales/leads?${search}` : "/admin/sales/leads")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-2 xl:grid-cols-6">
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel>Ara</FormLabel>
              <FormControl><Input {...field} placeholder="Firma, yetkili, telefon veya e-posta" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aşama</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{STATUS_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="follow"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Takip</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{FOLLOW_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {advisors.length > 0 && (
          <FormField
            control={form.control}
            name="advisorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Danışman</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="all">Tüm danışmanlar</SelectItem>
                    <SelectItem value="unassigned">Atanmamış</SelectItem>
                    {advisors.map((advisor) => <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="createdFrom"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Başlangıç</FormLabel>
              <FormControl><Input {...field} type="date" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="createdTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bitiş</FormLabel>
              <FormControl><Input {...field} type="date" /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
          <Button type="submit">Filtrele</Button>
          <Button type="button" variant="ghost" onClick={() => { form.reset({ q: "", status: "all", follow: "all", advisorId: "all", createdFrom: "", createdTo: "" }); router.push("/admin/sales/leads") }}>
            Temizle
          </Button>
        </div>
      </form>
    </Form>
  )
}
