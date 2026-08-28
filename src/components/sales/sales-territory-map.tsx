"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { divIcon, type LeafletEventHandlerFnMap, type Marker as LeafletMarkerInstance } from "leaflet"
import { MapContainer, Marker, TileLayer, Tooltip as LeafletTooltip } from "react-leaflet"
import { MapPin } from "lucide-react"
import { territoryCoordinatesForCity } from "@/lib/sales/territory"
import { cn } from "@/lib/utils"
import "leaflet/dist/leaflet.css"
import styles from "./sales-territory-map.module.css"

export type SalesTerritoryLead = {
  id: string
  businessName: string
  city: string | null
  status: string
}

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
const TILE_URL = process.env.NEXT_PUBLIC_SALES_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL
const TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_SALES_MAP_ATTRIBUTION?.trim() || DEFAULT_TILE_ATTRIBUTION

const TURKEY_BOUNDS = [
  [35.6, 25.4],
  [42.2, 44.9],
] as [[number, number], [number, number]]

const TURKEY_MAX_BOUNDS = [
  [34.2, 23.8],
  [43.6, 46.5],
] as [[number, number], [number, number]]

const CITY_OFFSETS = [
  [0, 0],
  [0.28, -0.38],
  [0.28, 0.38],
  [-0.28, -0.38],
  [-0.28, 0.38],
  [0.55, 0],
  [-0.55, 0],
] as const

function markerToneClass(status: string) {
  if (status === "won") return styles.markerSuccess
  if (status === "lost") return styles.markerDestructive
  if (["contacted", "demo_scheduled"].includes(status)) return styles.markerWarning
  if (["demo_completed", "proposal"].includes(status)) return styles.markerSecondary
  return undefined
}

function statusLabel(status: string) {
  if (status === "won") return "Kazanıldı"
  if (status === "lost") return "Kaybedildi"
  if (status === "contacted") return "İletişimde"
  if (status === "demo_scheduled") return "Demo planlandı"
  if (status === "demo_completed") return "Demo yapıldı"
  if (status === "proposal") return "Teklif"
  return "Yeni"
}

function AccessibleLeadMarker({
  lead,
  latitude,
  longitude,
  selected,
  onSelectLead,
}: {
  lead: SalesTerritoryLead
  latitude: number
  longitude: number
  selected: boolean
  onSelectLead: (lead: SalesTerritoryLead) => void
}) {
  const markerRef = useRef<LeafletMarkerInstance | null>(null)
  const label = `${lead.businessName}, ${lead.city ?? "şehir belirtilmedi"}, ${statusLabel(lead.status)}`
  const icon = useMemo(
    () => divIcon({
      className: styles.markerWrapper,
      html: `<span class="${cn(styles.marker, markerToneClass(lead.status), selected && styles.markerSelected)}"><span class="${styles.markerDot}"></span></span>`,
      iconAnchor: [14, 28],
      iconSize: [29, 29],
      tooltipAnchor: [0, -24],
    }),
    [lead.status, selected],
  )

  useEffect(() => {
    const element = markerRef.current?.getElement()
    if (!element) return
    element.setAttribute("aria-label", label)
    element.setAttribute("aria-pressed", String(selected))
  }, [label, selected])

  const eventHandlers = useMemo<LeafletEventHandlerFnMap>(() => ({
    click: () => onSelectLead(lead),
    keydown: (event) => {
      if (event.originalEvent.key !== "Enter" && event.originalEvent.key !== " ") return
      event.originalEvent.preventDefault()
      onSelectLead(lead)
    },
  }), [lead, onSelectLead])

  return (
    <Marker
      ref={markerRef}
      position={[latitude, longitude]}
      icon={icon}
      keyboard
      riseOnHover
      title={label}
      eventHandlers={eventHandlers}
    >
      <LeafletTooltip className={styles.companyTooltip} direction="top" offset={[0, -18]}>
        <span className="font-medium">{lead.businessName}</span>
        <span className="text-muted-foreground"> · {lead.city}</span>
      </LeafletTooltip>
    </Marker>
  )
}

export function SalesTerritoryMap({
  leads,
  selectedLeadId,
  onSelectLead,
}: {
  leads: SalesTerritoryLead[]
  selectedLeadId: string | null
  onSelectLead: (lead: SalesTerritoryLead) => void
}) {
  const [tileFailed, setTileFailed] = useState(false)
  const pins = useMemo(() => {
    const cityCounts = new Map<string, number>()
    return leads.flatMap((lead) => {
      const coordinates = territoryCoordinatesForCity(lead.city)
      if (!coordinates) return []
      const cityKey = `${coordinates.latitude}:${coordinates.longitude}`
      const occurrence = cityCounts.get(cityKey) ?? 0
      cityCounts.set(cityKey, occurrence + 1)
      const [latitudeOffset, longitudeOffset] = CITY_OFFSETS[occurrence % CITY_OFFSETS.length]
      const ring = Math.floor(occurrence / CITY_OFFSETS.length)
      const multiplier = ring + 1
      return [{
        lead,
        latitude: coordinates.latitude + latitudeOffset * multiplier,
        longitude: coordinates.longitude + longitudeOffset * multiplier,
      }]
    })
  }, [leads])
  const unmappedCount = leads.length - pins.length

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="territory-map-title">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-strong">Türkiye saha ağı</p>
          <h2 id="territory-map-title" className="mt-1 text-xl font-semibold text-foreground">Görüşme yapılan şirketler</h2>
          <p className="mt-1 text-sm text-muted-foreground">Haritayı yakınlaştırın veya bir pini seçerek şirketin satış kartına geçin.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-xl border bg-primary/10 px-3 py-2 text-primary-strong">
          <MapPin className="size-4" />
          <span className="text-sm font-semibold tabular-nums">{pins.length}</span>
          <span className="text-xs">haritada</span>
        </div>
      </div>

      <div
        className="relative h-80 w-full border-y sm:h-[26rem]"
        aria-label={`${pins.length} şirket adayı gerçek Türkiye haritasında gösteriliyor`}
      >
        <MapContainer
          bounds={TURKEY_BOUNDS}
          boundsOptions={{ padding: [18, 18] }}
          maxBounds={TURKEY_MAX_BOUNDS}
          maxBoundsViscosity={0.8}
          minZoom={4}
          maxZoom={18}
          scrollWheelZoom={false}
          className={styles.map}
        >
          <TileLayer
            url={TILE_URL}
            attribution={TILE_ATTRIBUTION}
            maxZoom={19}
            eventHandlers={{
              loading: () => setTileFailed(false),
              tileerror: () => setTileFailed(true),
            }}
          />
          {pins.map(({ lead, latitude, longitude }) => (
            <AccessibleLeadMarker
              key={lead.id}
              lead={lead}
              latitude={latitude}
              longitude={longitude}
              selected={lead.id === selectedLeadId}
              onSelectLead={onSelectLead}
            />
          ))}
        </MapContainer>

        {tileFailed && (
          <div role="status" className="absolute bottom-8 left-3 z-[500] max-w-xs rounded-xl border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
            Harita zemini yüklenemedi. Şirket pinleri gösterilmeye devam ediyor.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Harita durum renkleri">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Yeni</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" /> Görüşmede</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Kazanıldı</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" /> Kaybedildi</span>
        </div>
        {unmappedCount > 0 && <span>{unmappedCount} aday şehir bilgisi bekliyor</span>}
      </div>
    </section>
  )
}
