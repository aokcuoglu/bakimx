"use client"

import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { updateWorkshopAcquisition } from "@/app/admin/actions"
import { ACQUISITION_SOURCES, ACQUISITION_SOURCE_OPTIONS } from "@/lib/acquisition-sources"
import { typedResolver } from "@/lib/validations/resolver"
import { toast } from "sonner"

const acquisitionSchema = z.object({ acquisitionSource: z.enum(ACQUISITION_SOURCES), acquisitionAdvisorId: z.string().optional() }).superRefine((v, ctx) => {
  if (v.acquisitionSource === "sales_advisor" && !v.acquisitionAdvisorId) ctx.addIssue({ code: "custom", path: ["acquisitionAdvisorId"], message: "Temsilci seçiniz" })
})

export function AcquisitionEditor({ workshopId, source, advisorId, advisors }: { workshopId: string; source: (typeof ACQUISITION_SOURCES)[number]; advisorId: string | null; advisors: { id: string; label: string }[] }) {
  const form = useForm<z.infer<typeof acquisitionSchema>>({ resolver: typedResolver(acquisitionSchema), defaultValues: { acquisitionSource: source, acquisitionAdvisorId: advisorId ?? "" } })
  async function submit(values: z.infer<typeof acquisitionSchema>) {
    const result = await updateWorkshopAcquisition(workshopId, values)
    if (result.ok) toast.success("Edinim bilgisi güncellendi")
    else toast.error(result.error)
  }
  return <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="space-y-3">
    <FormField control={form.control} name="acquisitionSource" render={({ field }) => <FormItem><FormLabel>Kaynak</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{ACQUISITION_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
    <FormField control={form.control} name="acquisitionAdvisorId" render={({ field }) => <FormItem><FormLabel>Satış temsilcisi</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Atanmadı" /></SelectTrigger></FormControl><SelectContent><SelectItem value="">Atanmadı</SelectItem>{advisors.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
    <Button type="submit" disabled={form.formState.isSubmitting}>Kaydet</Button>
  </form></Form>
}
