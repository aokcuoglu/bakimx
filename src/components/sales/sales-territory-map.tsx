"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Building2, Loader2, MapPin, Radar, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { loadSalesGoogleLibrary } from "@/lib/sales/google-maps-client"
import { parseTurkishSalesAddress, type SalesPlaceSelection } from "@/lib/sales/google-place"

export type SalesTerritoryLead = {
  id: string
  businessName: string
  city: string | null
  status: string
  googlePlaceId: string | null
  latitude: number | null
  longitude: number | null
}

const TURKEY_CENTER = { lat: 39.1, lng: 35.2 }
const AUTOMOTIVE_PLACE_TYPES = ["car_repair", "tire_shop", "car_dealer", "car_wash"]

function statusLabel(status: string) {
  if (status === "won") return "Kazanıldı"
  if (status === "lost") return "Kaybedildi"
  if (status === "contacted") return "İletişimde"
  if (status === "demo_scheduled") return "Demo planlandı"
  if (status === "demo_completed") return "Demo yapıldı"
  if (status === "proposal") return "Teklif"
  return "Yeni"
}

function markerToken(status: string) {
  if (status === "won") return "--success"
  if (status === "lost") return "--destructive"
  if (["contacted", "demo_scheduled"].includes(status)) return "--warning"
  if (["demo_completed", "proposal"].includes(status)) return "--secondary"
  return "--primary"
}

function haversineMeters(a: google.maps.LatLng, b: google.maps.LatLng) {
  const earthRadius = 6_371_000
  const toRadians = (value: number) => value * Math.PI / 180
  const latitudeDelta = toRadians(b.lat() - a.lat())
  const longitudeDelta = toRadians(b.lng() - a.lng())
  const aLatitude = toRadians(a.lat())
  const bLatitude = toRadians(b.lat())
  const h = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(aLatitude) * Math.cos(bLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export function SalesTerritoryMap({
  leads,
  selectedLeadId,
  onSelectLead,
  onCreateLeadFromPlace,
  apiKey,
  mapId,
}: {
  leads: SalesTerritoryLead[]
  selectedLeadId: string | null
  onSelectLead: (lead: SalesTerritoryLead) => void
  onCreateLeadFromPlace?: (place: SalesPlaceSelection) => void
  apiKey: string | null
  mapId: string | null
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerLibraryRef = useRef<google.maps.MarkerLibrary | null>(null)
  const leadMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const discoveryMarkersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const onSelectLeadRef = useRef(onSelectLead)
  const fittedInitialLeadsRef = useRef(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [discoveries, setDiscoveries] = useState<SalesPlaceSelection[]>([])
  const [selectedDiscovery, setSelectedDiscovery] = useState<SalesPlaceSelection | null>(null)
  const configured = Boolean(apiKey && mapId)

  const mappedLeads = useMemo(
    () => leads.filter((lead) => lead.latitude != null && lead.longitude != null),
    [leads],
  )
  const unmappedCount = leads.length - mappedLeads.length

  useEffect(() => {
    onSelectLeadRef.current = onSelectLead
  }, [onSelectLead])

  useEffect(() => {
    if (!apiKey || !mapId) return
    let cancelled = false

    async function initialize() {
      try {
        const [{ Map }, markerLibrary] = await Promise.all([
          loadSalesGoogleLibrary(apiKey!, mapId!, "maps"),
          loadSalesGoogleLibrary(apiKey!, mapId!, "marker"),
        ])
        if (cancelled || !containerRef.current) return
        markerLibraryRef.current = markerLibrary
        mapRef.current = new Map(containerRef.current, {
          center: TURKEY_CENTER,
          zoom: 5,
          minZoom: 4,
          mapId: mapId!,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          restriction: {
            latLngBounds: { north: 43.6, south: 34.2, east: 46.5, west: 23.8 },
            strictBounds: false,
          },
        })
        setMapReady(true)
      } catch {
        if (!cancelled) setMapError(true)
      }
    }

    void initialize()
    return () => {
      cancelled = true
      leadMarkersRef.current.forEach((marker) => { marker.map = null })
      discoveryMarkersRef.current.forEach((marker) => { marker.map = null })
      leadMarkersRef.current = []
      discoveryMarkersRef.current = []
      mapRef.current = null
      markerLibraryRef.current = null
    }
  }, [apiKey, mapId])

  useEffect(() => {
    const map = mapRef.current
    const markerLibrary = markerLibraryRef.current
    if (!map || !markerLibrary || !mapReady) return

    leadMarkersRef.current.forEach((marker) => { marker.map = null })
    leadMarkersRef.current = []
    const styles = getComputedStyle(document.documentElement)
    const bounds = new google.maps.LatLngBounds()

    for (const lead of mappedLeads) {
      const position = { lat: lead.latitude!, lng: lead.longitude! }
      const selected = lead.id === selectedLeadId
      const pin = new markerLibrary.PinElement({
        background: styles.getPropertyValue(markerToken(lead.status)).trim(),
        borderColor: styles.getPropertyValue("--card").trim(),
        glyphColor: styles.getPropertyValue("--primary-foreground").trim(),
        scale: selected ? 1.25 : 1,
      })
      const marker = new markerLibrary.AdvancedMarkerElement({
        map,
        position,
        title: `${lead.businessName}, ${lead.city ?? "şehir belirtilmedi"}, ${statusLabel(lead.status)}`,
        gmpClickable: true,
        zIndex: selected ? 20 : 10,
      })
      marker.append(pin)
      marker.setAttribute("aria-label", marker.title ?? lead.businessName)
      marker.setAttribute("aria-pressed", String(selected))
      marker.addListener("click", () => onSelectLeadRef.current(lead))
      leadMarkersRef.current.push(marker)
      bounds.extend(position)
    }

    if (!fittedInitialLeadsRef.current && mappedLeads.length > 0) {
      fittedInitialLeadsRef.current = true
      if (mappedLeads.length === 1) {
        map.setCenter({ lat: mappedLeads[0].latitude!, lng: mappedLeads[0].longitude! })
        map.setZoom(15)
      } else {
        map.fitBounds(bounds, 48)
      }
    }
  }, [mapReady, mappedLeads, selectedLeadId])

  useEffect(() => {
    const map = mapRef.current
    const selectedLead = mappedLeads.find((lead) => lead.id === selectedLeadId)
    if (!map || !selectedLead) return
    map.panTo({ lat: selectedLead.latitude!, lng: selectedLead.longitude! })
    if ((map.getZoom() ?? 0) < 12) map.setZoom(13)
  }, [mappedLeads, selectedLeadId])

  useEffect(() => {
    const map = mapRef.current
    const markerLibrary = markerLibraryRef.current
    if (!map || !markerLibrary || !mapReady) return

    discoveryMarkersRef.current.forEach((marker) => { marker.map = null })
    discoveryMarkersRef.current = []
    const styles = getComputedStyle(document.documentElement)
    for (const place of discoveries) {
      const pin = new markerLibrary.PinElement({
        background: styles.getPropertyValue("--muted").trim(),
        borderColor: styles.getPropertyValue("--muted-foreground").trim(),
        glyphColor: styles.getPropertyValue("--foreground").trim(),
        glyphText: "+",
      })
      const marker = new markerLibrary.AdvancedMarkerElement({
        map,
        position: { lat: place.latitude, lng: place.longitude },
        title: `${place.businessName}, Google Maps işletmesi`,
        gmpClickable: true,
        zIndex: 5,
      })
      marker.append(pin)
      marker.setAttribute("aria-label", marker.title ?? place.businessName)
      marker.addListener("click", () => setSelectedDiscovery(place))
      discoveryMarkersRef.current.push(marker)
    }
  }, [discoveries, mapReady])

  async function discoverAutomotiveBusinesses() {
    const map = mapRef.current
    if (!apiKey || !mapId || !map) return
    const center = map.getCenter()
    const bounds = map.getBounds()
    if (!center || !bounds) return

    try {
      setDiscovering(true)
      const placesLibrary = await loadSalesGoogleLibrary(apiKey, mapId, "places")
      const radius = Math.min(50_000, Math.max(1_000, haversineMeters(center, bounds.getNorthEast())))
      const { places } = await placesLibrary.Place.searchNearby({
        fields: ["id", "displayName", "formattedAddress", "addressComponents", "location"],
        locationRestriction: { center, radius },
        includedPrimaryTypes: AUTOMOTIVE_PLACE_TYPES,
        maxResultCount: 20,
        rankPreference: "POPULARITY",
        language: "tr",
        region: "tr",
      })
      const existingPlaceIds = new Set(leads.flatMap((lead) => lead.googlePlaceId ? [lead.googlePlaceId] : []))
      const nextDiscoveries = places.flatMap((place) => {
        if (!place.location || !place.displayName || existingPlaceIds.has(place.id)) return []
        const parsed = parseTurkishSalesAddress(place.addressComponents ?? [])
        const formattedAddress = place.formattedAddress ?? parsed.address
        return [{
          placeId: place.id,
          businessName: place.displayName,
          formattedAddress,
          city: parsed.city,
          district: parsed.district,
          neighborhood: parsed.neighborhood,
          route: parsed.route,
          streetNumber: parsed.streetNumber,
          postalCode: parsed.postalCode,
          latitude: place.location.lat(),
          longitude: place.location.lng(),
        }]
      })
      setDiscoveries(nextDiscoveries)
      setSelectedDiscovery(nextDiscoveries[0] ?? null)
    } catch {
      setMapError(true)
    } finally {
      setDiscovering(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-labelledby="territory-map-title">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-strong">Türkiye saha ağı</p>
          <h2 id="territory-map-title" className="mt-1 text-xl font-semibold text-foreground">Görüşme yapılan şirketler</h2>
          <p className="mt-1 text-sm text-muted-foreground">Doğrulanmış konumları görün; bulunduğunuz bölgede yeni servisler keşfedin.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {configured && (
            <Button type="button" variant="outline" size="sm" disabled={!mapReady || discovering} onClick={() => void discoverAutomotiveBusinesses()}>
              {discovering ? <Loader2 className="size-4 animate-spin" /> : <Radar className="size-4" />}
              Bu bölgede servis ara
            </Button>
          )}
          <div className="flex items-center gap-2 rounded-xl border bg-primary/10 px-3 py-2 text-primary-strong">
            <MapPin className="size-4" />
            <span className="text-sm font-semibold tabular-nums">{mappedLeads.length}</span>
            <span className="text-xs">doğrulanmış</span>
          </div>
        </div>
      </div>

      <div className="relative h-80 w-full border-y bg-muted sm:h-[26rem]">
        {configured ? (
          <div ref={containerRef} className="h-full w-full" aria-label={`${mappedLeads.length} doğrulanmış şirket Google haritasında gösteriliyor`} />
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <Alert className="max-w-lg bg-card">
              <MapPin className="size-4" />
              <AlertTitle>Google Maps yapılandırması bekleniyor</AlertTitle>
              <AlertDescription>
                Harita kapalı olsa da satış portföyü çalışmaya devam eder. Tarayıcı anahtarı ve harita kimliği tanımlandığında yalnız doğrulanmış konumlar burada gösterilir.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {mapError && configured && (
          <div className="absolute inset-x-3 bottom-8 z-10">
            <Alert variant="destructive" className="mx-auto max-w-lg bg-card/95 shadow-md">
              <TriangleAlert className="size-4" />
              <AlertTitle>Google Maps işlemi tamamlanamadı</AlertTitle>
              <AlertDescription>API anahtarı, referrer kısıtı ve Places API (New) ayarlarını kontrol edin.</AlertDescription>
            </Alert>
          </div>
        )}

        {selectedDiscovery && (
          <div className="absolute bottom-4 left-4 right-4 z-10 max-w-md rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur-sm sm:right-auto">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground-strong">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{selectedDiscovery.businessName}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedDiscovery.formattedAddress || "Adres bilgisi bulunamadı"}</p>
                {onCreateLeadFromPlace && (
                  <Button type="button" size="sm" className="mt-3" onClick={() => onCreateLeadFromPlace(selectedDiscovery)}>
                    Satış fırsatı oluştur
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Harita durum renkleri">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Yeni</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warning" /> Görüşmede</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Kazanıldı</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive" /> Kaybedildi</span>
          {discoveries.length > 0 && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-muted-foreground" /> Google&apos;da keşfedildi</span>}
        </div>
        {unmappedCount > 0 && <span>{unmappedCount} aday konum doğrulaması bekliyor</span>}
      </div>
    </section>
  )
}
