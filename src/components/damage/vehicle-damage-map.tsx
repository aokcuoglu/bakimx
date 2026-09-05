"use client"

import Image from "next/image"
import { useState } from "react"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PhotoLightbox } from "@/components/shared/photo-lightbox"
import { getVehicleGeometry, VEHICLE_VIEWS, type BodyType, type VehicleView } from "./vehicle-geometry"

export type DamagePhoto = { id: string; label: string; fileUrl: string | null }
export type DamageRecord = { id: string; number?: number; zone: string; damageType: string; severity: string; note: string | null; photoIds?: string[] }
type Props = { damageMarks: DamageRecord[]; bodyType?: BodyType; photos?: DamagePhoto[]; onZoneClick?: (zone: string) => void; onEditMark?: (mark: DamageRecord) => void; onRemoveMark?: (id: string) => void; vehicle?: { plate: string; brand: string; model: string } | null; inspectionStatus?: string; inspectedAt?: string | null }
export function VehicleDamageMap({ damageMarks, bodyType = "sedan", photos = [], onZoneClick, onEditMark, onRemoveMark, vehicle, inspectionStatus, inspectedAt }: Props) {
  const [view,setView] = useState<VehicleView>("top")
  const [activePhotos,setActivePhotos] = useState<DamagePhoto[]>([])
  const [photoIndex,setPhotoIndex] = useState(0)
  const geometry = getVehicleGeometry(bodyType,view)
  return <div className="space-y-3">
    {vehicle && <p className="font-medium">{vehicle.plate} · {vehicle.brand} {vehicle.model}</p>}
    <p className="text-sm text-muted-foreground">{damageMarks.length ? `${damageMarks.length} hasar kaydı` : inspectionStatus === "no_visible_damage" ? "Kontrol edildi, görünür hasar gözlenmedi" : "Kontrol kaydı yok"}{inspectedAt && ` · ${new Date(inspectedAt).toLocaleString("tr-TR")}`}</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        {bodyType !== "unsupported" && <>
          <Tabs className="print:hidden" value={view} onValueChange={v => setView(v as VehicleView)}><TabsList className="w-full">{Object.entries(VEHICLE_VIEWS).map(([key,label]) => <TabsTrigger value={key} key={key}>{label}</TabsTrigger>)}</TabsList><TabsContent value={view}>
          <svg viewBox={view === "top" ? "120 0 240 300" : "0 0 480 300"} role={onZoneClick ? "group" : "img"} aria-label={`${VEHICLE_VIEWS[view]} araç görünüşü`} className="print:hidden h-[300px] w-full rounded-xl border bg-card sm:h-[340px]">
            {geometry.panels.map(p => { const marks = damageMarks.filter(m => m.zone === p.id); return <g key={p.id}>
              <path d={p.path} onClick={onZoneClick ? ()=>onZoneClick(p.id) : undefined} className={onZoneClick ? "cursor-pointer" : undefined} stroke="var(--foreground)" strokeWidth="1.3" fill={marks.length ? "var(--warning)" : p.glass ? "var(--muted)" : "var(--card)"} />
              {marks.length > 0 && <g><rect x={p.x-19} y={p.y-9} width={Math.max(38,marks.length*22)} height={18} rx={7} fill="var(--foreground)" /><text x={p.x} y={p.y+4} fill="var(--background)" fontSize={11} textAnchor="middle">{marks.map(m=>m.number ?? damageMarks.indexOf(m)+1).join(", ")}</text></g>}
              {onZoneClick && <foreignObject x={p.x-22} y={p.y-20} width={44} height={40}><Button type="button" variant="ghost" className="h-full w-full rounded-md p-0 hover:bg-primary/10 focus-visible:ring-2" aria-label={`${VEHICLE_ZONES[p.id as keyof typeof VEHICLE_ZONES]} — hasar ekle`} onClick={()=>onZoneClick(p.id)}><span className="sr-only">{VEHICLE_ZONES[p.id as keyof typeof VEHICLE_ZONES]}</span></Button></foreignObject>}
            </g> })}
            {geometry.details.map((d,i)=><path key={i} d={d} fill="var(--muted)" stroke="var(--foreground)" strokeWidth="1.2" pointerEvents="none" />)}
          </svg></TabsContent></Tabs>
          <div className="hidden print:grid print:grid-cols-2 print:gap-2">{(Object.entries(VEHICLE_VIEWS) as [VehicleView,string][]).map(([printView,label])=><figure key={printView} className="break-inside-avoid"><figcaption className="text-xs">{label}</figcaption><svg viewBox="0 0 480 300" aria-label={`${label} basılı araç görünüşü`}>{getVehicleGeometry(bodyType,printView).panels.map(p=><g key={p.id}><path d={p.path} fill="none" stroke="currentColor" strokeWidth={1.3} /><text x={p.x} y={p.y+4} fontSize={13} textAnchor="middle" fill="currentColor">{damageMarks.filter(m=>m.zone===p.id).map(m=>`#${m.number ?? damageMarks.indexOf(m)+1}`).join(", ")}</text></g>)}{getVehicleGeometry(bodyType,printView).details.map((d,i)=><path key={i} d={d} fill="none" stroke="currentColor" />)}</svg></figure>)}</div>
          <p className="text-xs text-muted-foreground">Temsili şema. Sağ ve sol sürüş yönüne göredir. {view === "left" || view === "right" ? "Aracın önü soldadır." : ""}</p>
        </>}
        {onZoneClick && <Accordion type="single" collapsible><AccordionItem value="zones"><AccordionTrigger>Bölge listesinden hasar ekle</AccordionTrigger><AccordionContent><div className="grid grid-cols-2 gap-1">{Object.entries(VEHICLE_ZONES).map(([key,label])=><Button key={key} type="button" variant="outline" size="sm" onClick={()=>onZoneClick(key)}>{label}</Button>)}</div></AccordionContent></AccordionItem></Accordion>}
      </div>
      <div className="space-y-3" aria-label="Hasar kayıtları">
        {damageMarks.map((m,index)=>{ const linked = photos.filter(p=>m.photoIds?.includes(p.id)); return <article key={m.id} className="break-inside-avoid rounded-xl border bg-card p-3" data-damage-number={m.number ?? index+1}>
          <div className="flex items-start justify-between gap-2"><h4 className="font-medium">#{m.number ?? index+1} · {VEHICLE_ZONES[m.zone as keyof typeof VEHICLE_ZONES] || m.zone}</h4><div className="flex gap-1">{onEditMark && <Button type="button" variant="outline" size="sm" onClick={()=>onEditMark(m)}>Düzenle</Button>}{onRemoveMark && <Button type="button" variant="ghost" size="sm" onClick={()=>onRemoveMark(m.id)}>Kaldır</Button>}</div></div>
          <p className="text-sm text-muted-foreground">{DAMAGE_TYPES[m.damageType as keyof typeof DAMAGE_TYPES]?.label} · {DAMAGE_SEVERITY[m.severity as keyof typeof DAMAGE_SEVERITY]?.label}</p>
          {m.note && <p className="mt-2 text-sm whitespace-pre-wrap">{m.note}</p>}
          {linked.length ? <div className="mt-3 flex flex-wrap gap-2">{linked.map((p,i)=><Button key={p.id} type="button" variant="outline" className="h-20 w-24 overflow-hidden p-0 print:h-36 print:w-44" aria-label={`Hasar ${m.number ?? index+1}, ${p.label} fotoğrafını aç`} onClick={()=>{setActivePhotos(linked);setPhotoIndex(i)}}>{p.fileUrl ? <Image unoptimized width={96} height={80} src={p.fileUrl} alt={p.label} className="h-full w-full object-cover" /> : p.label}</Button>)}</div> : <p className="mt-3 text-xs text-muted-foreground">Fotoğraf eklenmedi</p>}
        </article>})}
      </div>
    </div>
    <PhotoLightbox photos={activePhotos} index={photoIndex} onIndexChange={setPhotoIndex} open={activePhotos.length>0} onOpenChange={open=>{if(!open)setActivePhotos([])}} />
  </div>
}
