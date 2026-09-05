"use client"

import { useState, useEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { DAMAGE_SEVERITY, DAMAGE_TYPES, VEHICLE_ZONES } from "@/lib/constants"
import { damageMarkSchema, type DamageMarkValues } from "@/lib/validations/intake"
import { typedResolver } from "@/lib/validations/resolver"
import { PhotoAnnotate, PersistedPhotoEditor } from "@/components/intake/photo-annotate"
import { Checkbox } from "@/components/ui/checkbox"
import { BODY_TYPES, type BodyType } from "@/components/damage/vehicle-geometry"
import { VehicleDamageMap, type DamageRecord, type DamagePhoto } from "@/components/damage/vehicle-damage-map"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { BrandSpinner } from "@/components/shared/brand-spinner"

type DamageMark = DamageRecord

export function DamageCapture({ intakeFormId, vehicle, readOnly = false, reloadKey }: { intakeFormId: string; readOnly?: boolean; reloadKey?: string; vehicle: { plate: string; brand: string; model: string } | null }) {
  const [marks, setMarks] = useState<DamageMark[]>([])
  const [photos, setPhotos] = useState<DamagePhoto[]>([])
  const [bodyType, setBodyType] = useState<BodyType>("sedan")
  const [inspectionStatus, setInspectionStatus] = useState("not_recorded")
  const [inspectedAt, setInspectedAt] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [metadataBusy, setMetadataBusy] = useState(false)
  const [photoDirty, setPhotoDirty] = useState(false)
  const backRequested = useRef(false)
  const discardAndGoBack = useRef(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<DamageMarkValues>({
    resolver: typedResolver(damageMarkSchema),
    defaultValues: { intakeFormId, zone: "front_bumper", damageType: "scratch", severity: "light", note: "" },
  })
  const selectedZone = useWatch({ control: form.control, name: "zone" })

  useEffect(() => {
    let alive = true
    fetch(`/api/intakes/damage?intakeFormId=${encodeURIComponent(intakeFormId)}`).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Hasar kayıtları yüklenemedi")
      if (!alive) return
      setMarks(data.marks); setPhotos(data.photos); setBodyType(data.bodyType); setInspectionStatus(data.inspectionStatus); setInspectedAt(data.inspectedAt); setLoaded(true)
    }).catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [intakeFormId, reloadKey])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dialogOpen && (form.formState.isDirty || photoDirty)) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dialogOpen, form.formState.isDirty, photoDirty])
  const hasUnsavedDraft = dialogOpen && (form.formState.isDirty || photoDirty)
  useEffect(() => {
    if (!hasUnsavedDraft) return
    // A same-URL entry protects only this editor. Preserve Next's private state
    // and never intercept navigation outside the lifetime of this dirty draft.
    const marker = crypto.randomUUID()
    const url = window.location.href
    window.history.pushState({ ...window.history.state, damageDraft: marker }, "", url)
    const onBack = (event: PopStateEvent) => {
      if (window.history.state?.damageDraft === marker) return
      event.stopImmediatePropagation()
      window.history.pushState({ ...event.state, damageDraft: marker }, "", url)
      backRequested.current = true
      setDiscardOpen(true)
    }
    window.addEventListener("popstate", onBack, true)
    return () => {
      window.removeEventListener("popstate", onBack, true)
      if (window.history.state?.damageDraft === marker) {
        window.history.go(discardAndGoBack.current ? -2 : -1)
      }
      backRequested.current = false
      discardAndGoBack.current = false
    }
  }, [hasUnsavedDraft])
  function closeEditor() { if (form.formState.isDirty || photoDirty) setDiscardOpen(true); else setDialogOpen(false) }
  async function updateInspection(values: { bodyType?: BodyType; inspectionStatus?: string }) {
    setMetadataBusy(true)
    try {
      const response = await fetch("/api/intakes/damage", {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({intakeFormId,...values})})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Kontrol kaydı kaydedilemedi")
      const current = await fetch(`/api/intakes/damage?intakeFormId=${encodeURIComponent(intakeFormId)}`)
      if (!current.ok) throw new Error("Kontrol kaydedildi; güncel bilgileri görmek için sayfayı yenileyin.")
      const saved = await current.json()
      setBodyType(saved.bodyType); setInspectionStatus(saved.inspectionStatus); setInspectedAt(saved.inspectedAt)
    } catch(e) { toast.error(e instanceof Error ? e.message : "Kaydedilemedi") }
    finally {setMetadataBusy(false)}
  }
  function refreshAvailablePhotos() {
    void fetch(`/api/intakes/damage?intakeFormId=${encodeURIComponent(intakeFormId)}`).then(async response => {
      if (!response.ok) return
      const data = await response.json()
      setPhotos(data.photos)
    }).catch(() => { /* Existing photo choices and draft remain available offline. */ })
  }
  function editMark(mark: DamageMark) {
    refreshAvailablePhotos()
    setEditingId(mark.id)
    form.reset({intakeFormId,zone:mark.zone as DamageMarkValues["zone"],damageType:mark.damageType as DamageMarkValues["damageType"],severity:mark.severity as DamageMarkValues["severity"],note:mark.note || "",photoIds:mark.photoIds || []})
    setError("");setDialogOpen(true)
  }
  function chooseZone(zone: string) {
    refreshAvailablePhotos()
    setEditingId(null)
    form.reset({ intakeFormId, zone: zone as DamageMarkValues["zone"], damageType: "scratch", severity: "light", note: "", photoIds: [], requestId: crypto.randomUUID() })
    setError("")
    setDialogOpen(true)
  }

  async function save(values: DamageMarkValues) {
    setError("")
    try {
      const response = await fetch("/api/intakes/damage", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, ...(editingId ? {id:editingId} : {}) }) })
      const data = await response.json() as { error?: string; mark?: DamageMark }
      if (!response.ok || !data.mark) { setError(data.error || "Hasar kaydedilemedi. Tekrar deneyin."); return }
      setMarks((current) => editingId ? current.map(mark => mark.id === editingId ? data.mark! : mark) : [...current, data.mark!])
      setInspectionStatus("not_recorded"); setInspectedAt(null)
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
    <div className="space-y-3" data-testid="damage-capture">
      <div>
        <h3 className="font-medium">Hasar haritası</h3>
        <p className="text-sm text-muted-foreground">Hasarı panelden veya bölge listesinden ekleyin. Fotoğraf eklemeniz önerilir.</p>
      </div>
      {error && !dialogOpen && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!loaded && !error && <p role="status">Hasar kayıtları yükleniyor…</p>}
      {loaded && <>
        {!readOnly && <div className="flex flex-wrap items-center gap-2">
          <Select value={bodyType} onValueChange={v=>void updateInspection({bodyType:v as BodyType})} disabled={metadataBusy}><SelectTrigger aria-label="Araç şeması" className="w-56"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(BODY_TYPES).map(([key,label])=><SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select>
          <Button type="button" variant="outline" className="h-auto min-h-9 whitespace-normal text-left" disabled={metadataBusy || marks.length>0} onClick={()=>void updateInspection({inspectionStatus:"no_visible_damage"})}>Kontrol edildi, görünür hasar gözlenmedi</Button>
        </div>}
        <VehicleDamageMap damageMarks={marks} photos={photos} bodyType={bodyType} inspectionStatus={inspectionStatus} inspectedAt={inspectedAt} onZoneClick={readOnly ? undefined : chooseZone} onEditMark={readOnly ? undefined : editMark} onRemoveMark={readOnly ? undefined : setRemoveId} vehicle={vehicle} />
      </>}

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!form.formState.isSubmitting) { if(open) setDialogOpen(true); else closeEditor() } }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{VEHICLE_ZONES[selectedZone] || "Hasar ekle"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(save)}>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <FormField control={form.control} name="damageType" render={({ field }) => <FormItem><FormLabel>Hasar türü</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Hasar türü seçin" /></SelectTrigger></FormControl><SelectContent>{Object.entries(DAMAGE_TYPES).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="severity" render={({ field }) => <FormItem><FormLabel>Derece</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger className="w-full"><SelectValue placeholder="Derece seçin" /></SelectTrigger></FormControl><SelectContent>{Object.entries(DAMAGE_SEVERITY).map(([key, item]) => <SelectItem key={key} value={key}>{item.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              <FormField control={form.control} name="note" render={({ field }) => <FormItem><FormLabel>Not</FormLabel><FormControl><Input {...field} placeholder="Örn. 5 cm çizik" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="photoIds" render={({ field }) => <FormItem><FormLabel>Bağlı fotoğraflar</FormLabel><p className="text-xs text-muted-foreground">Bir fotoğraf birden fazla hasara bağlanabilir.</p><div className="grid grid-cols-2 gap-2">{photos.map(photo => <div key={photo.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"><label className="flex items-center gap-2"><Checkbox checked={field.value?.includes(photo.id) || false} onCheckedChange={checked=>field.onChange(checked ? [...(field.value || []),photo.id] : (field.value || []).filter(id=>id!==photo.id))} />{photo.label}</label><PersistedPhotoEditor photoId={photo.id} onDirtyChange={setPhotoDirty} /></div>)}</div><FormMessage /></FormItem>} />
              <PhotoAnnotate onDirtyChange={setPhotoDirty} intakeFormId={intakeFormId} onUploaded={photo=>{setPhotos(current=>[...current,{id:photo.id,label:"Hasar fotoğrafı",fileUrl:photo.fileUrl || `/api/photos?id=${photo.id}`}]);form.setValue("photoIds",[...(form.getValues("photoIds") || []),photo.id],{shouldDirty:true})}} />
              <DialogFooter><Button type="button" variant="outline" size="lg" onClick={closeEditor}>Vazgeç</Button><Button type="submit" size="lg" disabled={form.formState.isSubmitting || photoDirty}>{form.formState.isSubmitting ? <BrandSpinner size={18} label="Kaydediliyor…" /> : "Hasarı Kaydet"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kaydedilmemiş değişiklikler var</AlertDialogTitle><AlertDialogDescription>Çıkarsanız hasar düzenlemesi kaydedilmez. Yüklenen fotoğraflar kabul kaydında kalır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>{backRequested.current=false}}>Düzenlemeye dön</AlertDialogCancel><AlertDialogAction onClick={()=>{discardAndGoBack.current=backRequested.current;setDiscardOpen(false);setDialogOpen(false)}}>Değişiklikleri bırak</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={removeId !== null} onOpenChange={(open) => { if (!open && !removing) setRemoveId(null) }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hasar işareti kaldırılsın mı?</AlertDialogTitle><AlertDialogDescription>Bu işlem kayıt geçmişine yazılır. Hasar fotoğrafları silinmez.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={removing}>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={removing} onClick={() => void remove()}>{removing ? <BrandSpinner size={18} label="Kaldırılıyor…" /> : "İşareti Kaldır"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
