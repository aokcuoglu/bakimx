"use client"

import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { DAMAGE_SEVERITY, DAMAGE_TYPES, VEHICLE_ZONES } from "@/lib/constants"
import { damageMarkSchema, type DamageMarkValues } from "@/lib/validations/intake"
import { typedResolver } from "@/lib/validations/resolver"
import { VehicleDamageMap } from "@/components/damage/vehicle-damage-map"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BrandSpinner } from "@/components/shared/brand-spinner"

type DamageMark = { id: string; zone: string; damageType: string; severity: string; note: string | null }

export function DamageCapture({ intakeFormId, vehicle }: { intakeFormId: string; vehicle: { plate: string; brand: string; model: string } | null }) {
  const [marks, setMarks] = useState<DamageMark[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<DamageMarkValues>({
    resolver: typedResolver(damageMarkSchema),
    defaultValues: { intakeFormId, zone: "front_bumper", damageType: "scratch", severity: "light", note: "" },
  })
  const selectedZone = useWatch({ control: form.control, name: "zone" })

  function chooseZone(zone: string) {
    form.reset({ intakeFormId, zone: zone as DamageMarkValues["zone"], damageType: "scratch", severity: "light", note: "" })
    setError("")
    setDialogOpen(true)
  }

  async function save(values: DamageMarkValues) {
    setError("")
    try {
      const response = await fetch("/api/intakes/damage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) })
      const data = await response.json() as { error?: string; mark?: DamageMark }
      if (!response.ok || !data.mark) { setError(data.error || "Hasar kaydedilemedi. Tekrar deneyin."); return }
      setMarks((current) => [...current, data.mark!])
      setDialogOpen(false)
      toast.success("Hasar işareti kaydedildi")
    } catch { setError("Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.") }
  }

  async function remove() {
    if (!removeId) return
    setRemoving(true)
    try {
      const response = await fetch(`/api/intakes/damage?id=${encodeURIComponent(removeId)}`, { method: "DELETE" })
      const data = await response.json() as { error?: string }
      if (!response.ok) { toast.error(data.error || "Hasar kaldırılamadı. Tekrar deneyin."); return }
      setMarks((current) => current.filter((mark) => mark.id !== removeId))
      toast.success("Hasar işareti kaldırıldı")
      setRemoveId(null)
    } catch { toast.error("Bağlantı kurulamadı. Hasar kaldırılmadı.") }
    finally { setRemoving(false) }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium">Hasar haritası</h3>
        <p className="text-sm text-muted-foreground">Araçta hasar yoksa bu bölümü boş bırakabilirsiniz.</p>
      </div>
      <VehicleDamageMap damageMarks={marks} onZoneClick={chooseZone} onRemoveMark={setRemoveId} vehicle={vehicle} />

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!form.formState.isSubmitting) setDialogOpen(open) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{VEHICLE_ZONES[selectedZone] || "Hasar ekle"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(save)}>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <FormField control={form.control} name="damageType" render={({ field }) => <FormItem><FormLabel>Hasar türü</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Hasar türü seçin" /></SelectTrigger></FormControl><SelectContent>{Object.entries(DAMAGE_TYPES).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="severity" render={({ field }) => <FormItem><FormLabel>Derece</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Derece seçin" /></SelectTrigger></FormControl><SelectContent>{Object.entries(DAMAGE_SEVERITY).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="note" render={({ field }) => <FormItem><FormLabel>Not</FormLabel><FormControl><Input {...field} placeholder="Örn. 5 cm çizik" /></FormControl><FormMessage /></FormItem>} />
              <DialogFooter><Button type="button" variant="outline" size="lg" onClick={() => setDialogOpen(false)}>Vazgeç</Button><Button type="submit" size="lg" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <BrandSpinner size={18} label="Kaydediliyor…" /> : "Hasarı Kaydet"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeId !== null} onOpenChange={(open) => { if (!open && !removing) setRemoveId(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hasar işareti kaldırılsın mı?</AlertDialogTitle><AlertDialogDescription>Bu işlem kayıt geçmişine yazılır. Hasar fotoğrafları silinmez.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={removing}>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={removing} onClick={() => void remove()}>{removing ? <BrandSpinner size={18} label="Kaldırılıyor…" /> : "İşareti Kaldır"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
