"use client"

import dynamic from "next/dynamic"
import Image from "next/image"
import { useState, useSyncExternalStore } from "react"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { PhotoLightbox } from "@/components/shared/photo-lightbox"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { getVehicleGeometry, type BodyType } from "./vehicle-geometry"
import { modelForBody } from "./vehicle-3d-models"

// three.js stays out of every other bundle: it is fetched only when the 3D view renders.
const Vehicle3DViewer = dynamic(() => import("./vehicle-3d-viewer"), { ssr: false, loading: () => <div className="grid h-[320px] place-items-center rounded-xl border bg-card sm:h-[400px]"><BrandSpinner size={40} label="3B model yükleniyor" /></div> })

let webglSupport: boolean | undefined
function detectWebGL() {
  if (webglSupport === undefined) {
    try { webglSupport = !!document.createElement("canvas").getContext("webgl2") } catch { webglSupport = false }
  }
  return webglSupport
}
const noopSubscribe = () => () => {}

export type DamagePhoto = { id: string; label: string; fileUrl: string | null }
export type DamageRecord = { id: string; number?: number; zone: string; damageType: string; severity: string; note: string | null; photoIds?: string[] }
type Props = { damageMarks: DamageRecord[]; bodyType?: BodyType; photos?: DamagePhoto[]; photosVisible?: boolean; onZoneClick?: (zone: string) => void; onEditMark?: (mark: DamageRecord) => void; onRemoveMark?: (id: string) => void; vehicle?: { plate: string; brand: string; model: string } | null; inspectionStatus?: string; inspectedAt?: string | null }
export function VehicleDamageMap({ damageMarks, bodyType = "sedan", photos = [], photosVisible = true, onZoneClick, onEditMark, onRemoveMark, vehicle, inspectionStatus, inspectedAt }: Props) {
  const [activePhotos,setActivePhotos] = useState<DamagePhoto[]>([])
  const [photoIndex,setPhotoIndex] = useState(0)
  const geometry = getVehicleGeometry(bodyType)
  const model = modelForBody(bodyType)
  const webgl = useSyncExternalStore(noopSubscribe, detectWebGL, () => false)
  const [mode,setMode] = useState<"3d" | "plan">("3d")
  const show3d = !!model && webgl && mode === "3d"
  const marksByZone: Partial<Record<string, number[]>> = {}
  damageMarks.forEach((m,i) => { (marksByZone[m.zone] ??= []).push(m.number ?? i+1) })
  return <div className="space-y-3">
    {vehicle && <p className="font-medium">{vehicle.plate} · {vehicle.brand} {vehicle.model}</p>}
    <p className="text-sm text-muted-foreground">{damageMarks.length ? `${damageMarks.length} hasar kaydı` : inspectionStatus === "no_visible_damage" ? "Kontrol edildi, görünür hasar gözlenmedi" : "Kontrol kaydı yok"}{inspectedAt && ` · ${new Date(inspectedAt).toLocaleString("tr-TR")}`}</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-2">
        {bodyType !== "unsupported" && <>
          {model && webgl && <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={v => v && setMode(v as "3d" | "plan")} aria-label="Hasar görünümü" className="print:hidden">
            <ToggleGroupItem value="3d">3B model</ToggleGroupItem>
            <ToggleGroupItem value="plan">Açılım şeması</ToggleGroupItem>
          </ToggleGroup>}
          {show3d && <div className="print:hidden"><Vehicle3DViewer model={model} marks={marksByZone} onZoneClick={onZoneClick} /></div>}
          <div className={cn("rounded-xl border bg-card p-3 sm:p-4", show3d && "hidden print:block")}>
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
          <p className={cn("text-xs text-muted-foreground", show3d && "hidden print:block")}>Temsili açılım şeması. Sol ve sağ, aracın sürüş yönüne göredir.</p>
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
