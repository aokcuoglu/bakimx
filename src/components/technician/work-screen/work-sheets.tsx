"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { BottomSheet } from "@/components/shared/bottom-sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import { ExternalLaborSheet, type ExternalLaborFormItem } from "@/components/technician/external-labor-sheet"
import {
  PurchaseFormSheet,
  type PurchaseFormItem,
  type SupplierInfo,
  type TechnicianInfo,
} from "@/components/technician/purchase-form-sheet"
import { TechnicianPhotoUpload } from "@/components/technician/technician-photo-upload"
import { addInternalNoteAction } from "@/app/(app)/technician/actions"
import { typedResolver } from "@/lib/validations/resolver"
import { internalNoteFormSchema, type InternalNoteFormInput } from "@/lib/validations/technician"

/** Parça/işçilik ekleme yüzeyi `TechnicianPartsLaborSection` içinde yaşar; burada kalanlar. */
export type WorkSheetState =
  | { kind: "purchase"; item: PurchaseFormItem | null }
  | { kind: "externalLabor"; item: ExternalLaborFormItem | null }
  | { kind: "photo" }
  | { kind: "note" }
  | null

/**
 * Kutucuklardan açılan yüzeylerin tek durağı. Dış parça / dış işçilik mevcut
 * formlarını (PurchaseFormSheet, ExternalLaborSheet) olduğu gibi açar; yeni
 * kayıt ve "Yapılacaklar" satırından düzenleme aynı yüzeyi paylaşır.
 */
export function WorkSheets({
  sheet,
  onClose,
  orderId,
  intakeFormId,
  orderStatus,
  existingPhotoTypes,
  vehicle,
  suppliers,
  technicians,
  defaultTechnicianId,
}: {
  sheet: WorkSheetState
  onClose: () => void
  orderId: string
  intakeFormId: string
  orderStatus: string
  existingPhotoTypes: string[]
  vehicle: PickerVehicle
  suppliers: SupplierInfo[]
  technicians: TechnicianInfo[]
  defaultTechnicianId: string | null
}) {
  // Kutucuklardan açılan diğer eklemeler gibi: telefonda alt sayfa, lg'de diyalog (#1061).
  const isMobile = useIsMobile()
  const surface = isMobile ? "sheet" : "dialog"
  const handleOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  if (!sheet) return null

  if (sheet.kind === "purchase") {
    return (
      <PurchaseFormSheet
        orderId={orderId}
        vehicle={vehicle}
        suppliers={suppliers}
        technicians={technicians}
        defaultTechnicianId={sheet.item ? null : defaultTechnicianId}
        item={sheet.item}
        surface={surface}
        open
        onOpenChange={handleOpenChange}
      />
    )
  }

  if (sheet.kind === "externalLabor") {
    return (
      <ExternalLaborSheet
        orderId={orderId}
        item={sheet.item}
        surface={surface}
        open
        onOpenChange={handleOpenChange}
      />
    )
  }

  if (sheet.kind === "photo") {
    return (
      <TechnicianPhotoUpload
        intakeFormId={intakeFormId}
        orderStatus={orderStatus}
        existingPhotoTypes={existingPhotoTypes}
        open
        onOpenChange={handleOpenChange}
        hideTrigger
      />
    )
  }

  return (
    <BottomSheet
      open
      onOpenChange={handleOpenChange}
      title="İç not ekle"
      description="Müşteriye görünmez."
    >
      <AddInternalNoteForm orderId={orderId} onDone={onClose} />
    </BottomSheet>
  )
}

function AddInternalNoteForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<InternalNoteFormInput, unknown, InternalNoteFormInput>({
    resolver: typedResolver(internalNoteFormSchema),
    defaultValues: { content: "" },
  })

  function submit(values: InternalNoteFormInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set("serviceOrderId", orderId)
    fd.set("content", values.content)
    startTransition(async () => {
      const res = await addInternalNoteAction(fd)
      if (res && "error" in res && res.error) {
        setServerError(res.error)
        return
      }
      toast.success("Not eklendi.")
      form.reset({ content: "" })
      router.refresh()
      onDone()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-3 pb-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Not</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="Ustaya, ofise ya da sonraki vardiyaya not bırakın…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="warning" size="lg" disabled={isPending} className="w-full">
          <Plus />
          Notu ekle
        </Button>
      </form>
    </Form>
  )
}
