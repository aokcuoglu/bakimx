"use client"

import { useEffect, useRef, useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import type { z } from "zod"
import { CheckCircle2, Loader2, MapPin, Search, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { loadSalesGoogleLibrary } from "@/lib/sales/google-maps-client"
import { parseTurkishSalesAddress } from "@/lib/sales/google-place"
import { salesLeadSchema } from "@/lib/validations/sales"

type SalesLeadFormValues = z.infer<typeof salesLeadSchema>

type Coordinates = { latitude: number; longitude: number }

function LocationPreviewMap({
  apiKey,
  mapId,
  coordinates,
  onMove,
}: {
  apiKey: string
  mapId: string
  coordinates: Coordinates | null
  onMove: (coordinates: Coordinates) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null)
  const onMoveRef = useRef(onMove)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    let cancelled = false
    const listeners: google.maps.MapsEventListener[] = []

    async function initialize() {
      try {
        const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          loadSalesGoogleLibrary(apiKey, mapId, "maps"),
          loadSalesGoogleLibrary(apiKey, mapId, "marker"),
        ])
        if (cancelled || !containerRef.current) return

        const map = new Map(containerRef.current, {
          center: coordinates
            ? { lat: coordinates.latitude, lng: coordinates.longitude }
            : { lat: 39.1, lng: 35.2 },
          zoom: coordinates ? 17 : 5,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        mapRef.current = map

        const styles = getComputedStyle(document.documentElement)
        const pin = new PinElement({
          background: styles.getPropertyValue("--primary").trim(),
          borderColor: styles.getPropertyValue("--card").trim(),
          glyphColor: styles.getPropertyValue("--primary-foreground").trim(),
        })
        const marker = new AdvancedMarkerElement({
          map: coordinates ? map : null,
          position: coordinates ? { lat: coordinates.latitude, lng: coordinates.longitude } : null,
          gmpDraggable: true,
          title: "Doğrulanacak şirket konumu",
        })
        marker.append(pin)
        markerRef.current = marker

        listeners.push(marker.addListener("dragend", () => {
          const position = marker.position
          if (!position) return
          const latLng = position instanceof google.maps.LatLng
            ? position
            : new google.maps.LatLng(position)
          onMoveRef.current({ latitude: latLng.lat(), longitude: latLng.lng() })
        }))
        listeners.push(map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return
          onMoveRef.current({ latitude: event.latLng.lat(), longitude: event.latLng.lng() })
        }))
      } catch {
        if (!cancelled) setLoadError(true)
      }
    }

    void initialize()
    return () => {
      cancelled = true
      listeners.forEach((listener) => listener.remove())
      if (markerRef.current) markerRef.current.map = null
      markerRef.current = null
      mapRef.current = null
    }
    // Harita örneği yalnız yapılandırma değiştiğinde yeniden kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, mapId])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || !coordinates) return
    const position = { lat: coordinates.latitude, lng: coordinates.longitude }
    marker.position = position
    marker.map = map
    map.panTo(position)
    if ((map.getZoom() ?? 0) < 15) map.setZoom(17)
  }, [coordinates])

  if (loadError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="size-4" />
        <AlertTitle>Konum haritası yüklenemedi</AlertTitle>
        <AlertDescription>Google Maps yapılandırmasını kontrol edip tekrar deneyin.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="h-64 w-full rounded-xl border bg-muted"
        aria-label="Şirket konumunu doğrulama haritası"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Pini sürükleyebilir veya haritada doğru noktaya tıklayabilirsiniz.
      </p>
    </div>
  )
}

export function SalesLocationPicker({
  apiKey,
  mapId,
}: {
  apiKey: string | null
  mapId: string | null
}) {
  const form = useFormContext<SalesLeadFormValues>()
  const query = useWatch({ control: form.control, name: "placeSearch" })
  const latitude = useWatch({ control: form.control, name: "latitude" })
  const longitude = useWatch({ control: form.control, name: "longitude" })
  const confirmed = useWatch({ control: form.control, name: "locationConfirmed" })
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([])
  const [searching, setSearching] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [queryTouched, setQueryTouched] = useState(false)
  const [showMap, setShowMap] = useState(
    () => form.getValues("latitude") != null && form.getValues("longitude") != null,
  )
  const [mapsError, setMapsError] = useState<string | null>(null)
  const placesLibraryRef = useRef<google.maps.PlacesLibrary | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const newestRequestRef = useRef(0)

  const configured = Boolean(apiKey && mapId)
  const coordinates = latitude != null && longitude != null ? { latitude, longitude } : null

  useEffect(() => {
    if (!apiKey || !mapId) return
    let cancelled = false
    void loadSalesGoogleLibrary(apiKey, mapId, "places")
      .then((library) => {
        if (!cancelled) placesLibraryRef.current = library
      })
      .catch(() => {
        if (!cancelled) setMapsError("Google Places yüklenemedi. API anahtarı ve etkin servisleri kontrol edin.")
      })
    return () => { cancelled = true }
  }, [apiKey, mapId])

  useEffect(() => {
    if (!configured || !queryTouched || !query || query.trim().length < 3 || !placesLibraryRef.current) {
      setSuggestions([])
      setSearching(false)
      return
    }

    const requestId = ++newestRequestRef.current
    const timer = window.setTimeout(async () => {
      const library = placesLibraryRef.current
      if (!library) return
      try {
        setSearching(true)
        sessionTokenRef.current ??= new library.AutocompleteSessionToken()
        const result = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          includedRegionCodes: ["tr"],
          language: "tr",
          region: "tr",
          sessionToken: sessionTokenRef.current,
        })
        if (requestId !== newestRequestRef.current) return
        setSuggestions(result.suggestions.flatMap((suggestion) => suggestion.placePrediction ? [suggestion.placePrediction] : []))
        setMapsError(null)
      } catch {
        if (requestId === newestRequestRef.current) {
          setSuggestions([])
          setMapsError("İşletme ve adres önerileri alınamadı. Birkaç saniye sonra tekrar deneyin.")
        }
      } finally {
        if (requestId === newestRequestRef.current) setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [configured, query, queryTouched])

  function clearResolvedLocation() {
    form.setValue("googlePlaceId", "")
    form.setValue("latitude", null)
    form.setValue("longitude", null)
    form.setValue("locationSource", null)
    form.setValue("locationConfirmed", false)
  }

  async function selectPrediction(prediction: google.maps.places.PlacePrediction) {
    try {
      setSelecting(true)
      const place = prediction.toPlace()
      await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "addressComponents", "location", "viewport", "primaryType"],
      })
      if (!place.location) {
        setMapsError("Seçilen sonuç için harita konumu bulunamadı.")
        return
      }

      const parsed = parseTurkishSalesAddress(place.addressComponents ?? [])
      const formattedAddress = place.formattedAddress ?? prediction.text.toString()
      form.setValue("placeSearch", place.displayName || formattedAddress, { shouldDirty: true })
      if (place.displayName) form.setValue("businessName", place.displayName, { shouldDirty: true, shouldValidate: true })
      form.setValue("city", parsed.city, { shouldDirty: true })
      form.setValue("district", parsed.district, { shouldDirty: true })
      form.setValue("neighborhood", parsed.neighborhood, { shouldDirty: true })
      form.setValue("route", parsed.route, { shouldDirty: true })
      form.setValue("streetNumber", parsed.streetNumber, { shouldDirty: true })
      form.setValue("postalCode", parsed.postalCode, { shouldDirty: true })
      form.setValue("address", parsed.address || formattedAddress, { shouldDirty: true })
      form.setValue("formattedAddress", formattedAddress, { shouldDirty: true })
      form.setValue("googlePlaceId", place.id, { shouldDirty: true })
      form.setValue("latitude", place.location.lat(), { shouldDirty: true })
      form.setValue("longitude", place.location.lng(), { shouldDirty: true })
      form.setValue("locationSource", "google_place", { shouldDirty: true })
      form.setValue("locationConfirmed", false, { shouldDirty: true })
      setSuggestions([])
      setQueryTouched(false)
      sessionTokenRef.current = null
      setMapsError(null)
      setShowMap(true)
    } catch {
      setMapsError("Seçilen işletmenin konum ayrıntıları alınamadı.")
    } finally {
      setSelecting(false)
    }
  }

  function moveLocation(next: Coordinates) {
    form.setValue("googlePlaceId", "", { shouldDirty: true })
    form.setValue("formattedAddress", "", { shouldDirty: true })
    form.setValue("latitude", next.latitude, { shouldDirty: true })
    form.setValue("longitude", next.longitude, { shouldDirty: true })
    form.setValue("locationSource", "manual_pin", { shouldDirty: true })
    form.setValue("locationConfirmed", false, { shouldDirty: true, shouldValidate: true })
  }

  if (!configured) {
    return (
      <Alert className="sm:col-span-2">
        <MapPin className="size-4" />
        <AlertTitle>Google konum doğrulaması yapılandırılmadı</AlertTitle>
        <AlertDescription>
          Şirketi adres bilgileriyle ekleyebilirsiniz; Google Maps anahtarı tanımlanana kadar kayıt haritada kesin konum olarak gösterilmez.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <FormField
        control={form.control}
        name="placeSearch"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Google Maps&apos;te işletme veya adres ara</FormLabel>
            <div className="relative">
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Servis adı, mahalle veya cadde yazın"
                  className="pr-9"
                  onChange={(event) => {
                    field.onChange(event)
                    setQueryTouched(true)
                    if (form.getValues("googlePlaceId") || form.getValues("locationConfirmed")) {
                      clearResolvedLocation()
                    }
                  }}
                />
              </FormControl>
              {searching || selecting
                ? <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />
                : <Search className="absolute right-3 top-2.5 size-4 text-muted-foreground" />}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      {suggestions.length > 0 && (
        <div role="listbox" aria-label="Google işletme ve adres önerileri" className="max-h-56 space-y-1 overflow-y-auto rounded-xl border bg-popover p-1 shadow-md">
          {suggestions.map((prediction) => (
            <Button
              key={prediction.placeId}
              type="button"
              variant="ghost"
              role="option"
              aria-selected="false"
              className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
              onClick={() => void selectPrediction(prediction)}
            >
              <MapPin className="size-4 shrink-0 text-primary" />
              <span>{prediction.text.toString()}</span>
            </Button>
          ))}
        </div>
      )}

      {mapsError && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{mapsError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((current) => !current)}>
          <MapPin className="size-4" /> {showMap ? "Haritayı kapat" : "Haritadan konum işaretle"}
        </Button>
        {coordinates && (
          <Button
            type="button"
            size="sm"
            variant={confirmed ? "outline" : "default"}
            onClick={() => {
              form.setValue("locationConfirmed", true, { shouldDirty: true, shouldValidate: true })
              void form.trigger(["latitude", "longitude", "locationSource", "locationConfirmed"])
            }}
          >
            <CheckCircle2 className="size-4" /> {confirmed ? "Konum doğrulandı" : "Bu konumu doğrula"}
          </Button>
        )}
      </div>

      {showMap && apiKey && mapId && (
        <LocationPreviewMap apiKey={apiKey} mapId={mapId} coordinates={coordinates} onMove={moveLocation} />
      )}

      {coordinates && !confirmed && (
        <p className="text-xs font-medium text-warning-strong">Portföye eklemeden önce haritadaki konumu doğrulayın.</p>
      )}
    </div>
  )
}
