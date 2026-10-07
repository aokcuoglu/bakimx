"use client"

import Image from "next/image"
import { useState } from "react"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { PhotoLightbox } from "@/components/shared/photo-lightbox"
import { cn } from "@/lib/utils"
import { getVehicleGeometry, type BodyType } from "./vehicle-geometry"

export type DamagePhoto = { id: string; label: string; fileUrl: string | null }
export type DamageRecord = { id: string; number?: number; zone: string; damageType: string; severity: string; note: string | null; photoIds?: string[] }
type Props = { damageMarks: DamageRecord[]; bodyType?: BodyType; photos?: DamagePhoto[]; photosVisible?: boolean; onZoneClick?: (zone: string) => void; onEditMark?: (mark: DamageRecord) => void; onRemoveMark?: (id: string) => void; vehicle?: { plate: string; brand: string; model: string } | null; inspectionStatus?: string; inspectedAt?: string | null }
export function VehicleDamageMap({ damageMarks, bodyType = "sedan", photos = [], photosVisible = true, onZoneClick, onEditMark, onRemoveMark, vehicle, inspectionStatus, inspectedAt }: Props) {
  const [activePhotos,setActivePhotos] = useState<DamagePhoto[]>([])
  const [photoIndex,setPhotoIndex] = useState(0)
  const geometry = getVehicleGeometry(bodyType)
  return <div className="space-y-3">
    {vehicle && <p className="font-medium">{vehicle.plate} · {vehicle.brand} {vehicle.model}</p>}
    <p className="text-sm text-muted-foreground">{damageMarks.length ? `${damageMarks.length} hasar kaydı` : inspectionStatus === "no_visible_damage" ? "Kontrol edildi, görünür hasar gözlenmedi" : "Kontrol kaydı yok"}{inspectedAt && ` · ${new Date(inspectedAt).toLocaleString("tr-TR")}`}</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        {bodyType !== "unsupported" && <>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <svg viewBox={geometry.viewBox} role={onZoneClick ? "group" : "img"} aria-label="Araç hasar şeması" className="mx-auto block h-auto w-full max-w-[380px]" strokeLinejoin="round">
              {geometry.labels.map(l => <text key={l.text} x={l.x} y={l.y} transform={l.rotate ? `rotate(${l.rotate} ${l.x} ${l.y})` : undefined} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600} letterSpacing="0.12em" className="fill-muted-foreground">{l.text}</text>)}
              {geometry.panels.map(p => {
                const damaged = damageMarks.some(m => m.zone === p.id)
                const shape = <path d={p.path} strokeWidth={1.2} className={cn("transition-colors", damaged ? "fill-warning/40 stroke-warning-strong" : cn("stroke-foreground/55", p.tire ? "fill-foreground/80" : p.glass ? "fill-muted" : "fill-card"), onZoneClick && cn("cursor-pointer group-focus-visible/button:stroke-ring group-focus-visible/button:stroke-[3]", p.tire ? "hover:fill-foreground/60" : "hover:fill-primary/15"))} />
                if (!onZoneClick) return <g key={p.id}>{shape}</g>
                return <Button asChild variant="ghost" key={p.id} className="p-0"><g role="button" tabIndex={0} aria-label={`${VEHICLE_ZONES[p.id as keyof typeof VEHICLE_ZONES]} — hasar ekle`} onClick={()=>onZoneClick(p.id)} onKeyDown={event=>{if(event.key === "Enter" || event.key === " "){event.preventDefault();onZoneClick(p.id)}}}>{shape}</g></Button>
              })}
              {geometry.details.map((d,i)=><path key={i} d={d} strokeWidth={1} className="fill-muted stroke-foreground/45" pointerEvents="none" />)}
              {geometry.panels.map(p => {
                const numbers = damageMarks.filter(m => m.zone === p.id).map(m => m.number ?? damageMarks.indexOf(m)+1)
                const perRow = Math.min(numbers.length, 3)
                return numbers.map((num,i) => <g key={`${p.id}-${num}`} transform={`translate(${p.x + ((i % 3) - (perRow - 1) / 2) * 22},${p.y + Math.floor(i / 3) * 22})`} pointerEvents="none">
                  <circle r={10} className="fill-foreground stroke-card" strokeWidth={1.5} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={600} className="fill-background">{num}</text>
                </g>)
              })}
            </svg>
          </div>
          <p className="text-xs text-muted-foreground">Temsili açılım şeması. Sol ve sağ, aracın sürüş yönüne göredir.</p>
        </>}
        {onZoneClick && <Accordion type="single" collapsible><AccordionItem value="zones"><AccordionTrigger>Bölge listesinden hasar ekle</AccordionTrigger><AccordionContent><div className="grid grid-cols-2 gap-1">{Object.entries(VEHICLE_ZONES).map(([key,label])=><Button key={key} type="button" variant="outline" size="sm" onClick={()=>onZoneClick(key)}>{label}</Button>)}</div></AccordionContent></AccordionItem></Accordion>}
      </div>
      <div className="space-y-3" aria-label="Hasar kayıtları">
        {damageMarks.map((m,index)=>{ const linked = photos.filter(p=>m.photoIds?.includes(p.id)); return <article key={m.id} className="break-inside-avoid rounded-xl border bg-card p-3" data-damage-number={m.number ?? index+1}>
          <div className="flex items-start justify-between gap-2"><h4 className="font-medium">#{m.number ?? index+1} · {VEHICLE_ZONES[m.zone as keyof typeof VEHICLE_ZONES] || m.zone}</h4><div className="flex gap-1">{onEditMark && <Button type="button" variant="outline" size="sm" onClick={()=>onEditMark(m)}>Düzenle</Button>}{onRemoveMark && <Button type="button" variant="ghost" size="sm" onClick={()=>onRemoveMark(m.id)}>Kaldır</Button>}</div></div>
          <p className="text-sm text-muted-foreground">{DAMAGE_TYPES[m.damageType as keyof typeof DAMAGE_TYPES]?.label} · {DAMAGE_SEVERITY[m.severity as keyof typeof DAMAGE_SEVERITY]?.label}</p>
          {m.note && <p className="mt-2 text-sm whitespace-pre-wrap">{m.note}</p>}
          {linked.length ? <div className="mt-3 flex flex-wrap gap-2">{linked.map((p,i)=><Button key={p.id} type="button" variant="outline" className="h-20 w-24 overflow-hidden p-0 print:h-36 print:w-44" aria-label={`Hasar ${m.number ?? index+1}, ${p.label} fotoğrafını aç`} onClick={()=>{setActivePhotos(linked);setPhotoIndex(i)}}>{p.fileUrl ? <Image unoptimized width={96} height={80} src={p.fileUrl} alt={p.label} className="h-full w-full object-cover" /> : p.label}</Button>)}</div> : <p className="mt-3 text-xs text-muted-foreground">{photosVisible ? "Fotoğraf eklenmedi" : "Fotoğraflar bu paylaşımda gösterilmiyor"}</p>}
        </article>})}
      </div>
    </div>
    <PhotoLightbox photos={activePhotos} index={photoIndex} onIndexChange={setPhotoIndex} open={activePhotos.length>0} onOpenChange={open=>{if(!open)setActivePhotos([])}} />
  </div>
}
