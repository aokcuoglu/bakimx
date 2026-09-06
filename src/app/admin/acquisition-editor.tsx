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
    if (result.ok) toast.success("Referans bilgisi güncellendi")
    else toast.error(result.error)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="acquisitionSource"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kaynak</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACQUISITION_SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="acquisitionAdvisorId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Satış temsilcisi</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Atanmadı" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">Atanmadı</SelectItem>
                    {advisors.map((advisor) => (
                      <SelectItem key={advisor.id} value={advisor.id}>{advisor.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>Kaydet</Button>
        </div>
      </form>
    </Form>
  )
}
