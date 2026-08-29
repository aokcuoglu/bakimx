"use client"

import { useEffect, useRef, useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import type { z } from "zod"
import { CheckCircle2, Loader2, MapPin, Search, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { FormControl, FormField, FormItem, FormLabel, FormMessage, useFormField } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CitySelect, DistrictSelect } from "@/components/shared/location-select"
import {
  googleMapsClientErrorMessage,
  loadSalesGoogleLibrary,
  reserveSalesGoogleMapsUsage,
} from "@/lib/sales/google-maps-client"
import {
  composeSalesAddress,
  matchesSelectedTurkishArea,
  parseTurkishSalesAddress,
  type ParsedSalesAddress,
} from "@/lib/sales/google-place"
import { canonicalizeTurkishCity } from "@/lib/tr-cities"
import { canonicalizeTurkishDistrict } from "@/lib/tr-districts"
import { salesLeadSchema } from "@/lib/validations/sales"

type SalesLeadFormValues = z.infer<typeof salesLeadSchema>

type Coordinates = { latitude: number; longitude: number }

type GoogleAddressComponentKind = "neighborhood" | "route"

type GoogleAddressOption = {
  id: string
  label: string
  componentLabel: string
  prediction: google.maps.places.PlacePrediction
}

type GoogleAddressSelection = {
  value: string
  formattedAddress: string
  parsed: ParsedSalesAddress
  coordinates: Coordinates | null
}

function GoogleAddressComponentCombobox({
  apiKey,
  mapId,
  kind,
  city,
  district,
  neighborhood,
  value,
  disabled,
  onBlur,
  onClear,
  onSelect,
}: {
  apiKey: string | null
  mapId: string | null
  kind: GoogleAddressComponentKind
  city: string
  district: string
  neighborhood?: string
  value: string
  disabled: boolean
  onBlur: () => void
  onClear: () => void
  onSelect: (selection: GoogleAddressSelection) => void
}) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<GoogleAddressOption[]>([])
  const [queryTouched, setQueryTouched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [placesLibrary, setPlacesLibrary] = useState<google.maps.PlacesLibrary | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const newestRequestRef = useRef(0)
  const configured = Boolean(apiKey && mapId)
  const { error: fieldError, formDescriptionId, formItemId, formMessageId } = useFormField()

  useEffect(() => {
    if (!apiKey || !mapId) return
    let cancelled = false
    void loadSalesGoogleLibrary(apiKey, mapId, "places")
      .then((library) => {
        if (!cancelled) setPlacesLibrary(library)
      })
      .catch(() => {
        if (!cancelled) setError("Google adres seçenekleri yüklenemedi.")
      })
    return () => { cancelled = true }
  }, [apiKey, mapId])

  useEffect(() => {
    const library = placesLibrary
    const query = inputValue.trim()
    if (!configured || disabled || !queryTouched || query.length < 2 || !library) {
      return
    }

    const requestId = ++newestRequestRef.current
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true)
        sessionTokenRef.current ??= new library.AutocompleteSessionToken()
        const context = kind === "route"
          ? [neighborhood, district, city].filter(Boolean).join(", ")
          : [district, city].filter(Boolean).join(", ")
        await reserveSalesGoogleMapsUsage("autocomplete_requests")
        const result = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: [query, context].filter(Boolean).join(", "),
          includedPrimaryTypes: kind === "route"
            ? ["route"]
            : ["neighborhood", "sublocality", "administrative_area_level_4"],
          includedRegionCodes: ["tr"],
          language: "tr",
          region: "tr",
          sessionToken: sessionTokenRef.current,
        })
        if (requestId !== newestRequestRef.current) return
        setSuggestions(result.suggestions.flatMap((suggestion) => {
          const prediction = suggestion.placePrediction
          if (!prediction) return []
          const label = prediction.text.toString().trim()
          return [{
            id: prediction.placeId,
            label,
            componentLabel: prediction.mainText?.toString().trim() || label,
            prediction,
          }]
        }))
        setError(null)
      } catch (requestError) {
        if (requestId === newestRequestRef.current) {
          setSuggestions([])
          setError(googleMapsClientErrorMessage(
            requestError,
            "Google adres önerileri alınamadı. Birkaç saniye sonra tekrar deneyin.",
          ))
        }
      } finally {
        if (requestId === newestRequestRef.current) setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [city, configured, disabled, district, inputValue, kind, neighborhood, placesLibrary, queryTouched])

  async function selectOption(option: GoogleAddressOption) {
    try {
      setSelecting(true)
      const place = option.prediction.toPlace()
      await reserveSalesGoogleMapsUsage("place_details_essentials")
      await place.fetchFields({ fields: ["formattedAddress", "addressComponents", "location"] })
      const parsed = parseTurkishSalesAddress(place.addressComponents ?? [])
      const formattedAddress = place.formattedAddress ?? option.label
      const googleResultAddress = [formattedAddress, option.label].filter(Boolean).join(", ")
      if (!matchesSelectedTurkishArea(parsed, googleResultAddress, city, district)) {
        setError(`Seçilen sonuç ${city} / ${district} ile örtüşmüyor.`)
        return
      }
      const selectedValue = (kind === "neighborhood" ? parsed.neighborhood : parsed.route)
        || option.componentLabel
      onSelect({
        value: selectedValue,
        formattedAddress,
        parsed,
        coordinates: place.location
          ? { latitude: place.location.lat(), longitude: place.location.lng() }
          : null,
      })
      setInputValue(selectedValue)
      setSuggestions([])
      setQueryTouched(false)
      sessionTokenRef.current = null
      setError(null)
    } catch (selectionError) {
      setError(googleMapsClientErrorMessage(
        selectionError,
        "Seçilen Google adresinin ayrıntıları alınamadı.",
      ))
    } finally {
      setSelecting(false)
    }
  }

  const placeholder = !configured
    ? "Google Maps yapılandırması gerekli"
    : kind === "neighborhood"
      ? disabled ? "Önce ilçe seçin" : "Mahalle arayıp seçin"
      : disabled ? "Önce mahalle seçin" : "Cadde veya sokak arayıp seçin"

  return (
    <div className="space-y-1.5">
      <Combobox
        items={suggestions}
        filter={null}
        inputValue={inputValue}
        itemToStringLabel={(option: GoogleAddressOption) => option.label}
        itemToStringValue={(option: GoogleAddressOption) => option.label}
        onInputValueChange={(next: string) => {
          setInputValue(next)
          setQueryTouched(true)
          setSuggestions([])
          if (next.trim().length < 2) {
            newestRequestRef.current += 1
            setSearching(false)
          }
          if (!next && value) onClear()
        }}
        onValueChange={(option: GoogleAddressOption | null) => {
          if (option) void selectOption(option)
        }}
        disabled={disabled || selecting}
      >
        <ComboboxInput
          id={formItemId}
          aria-describedby={fieldError ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
          aria-invalid={fieldError ? true : undefined}
          placeholder={selecting ? "Adres doğrulanıyor…" : placeholder}
          disabled={disabled || selecting}
          className="w-full"
          onBlur={() => {
            onBlur()
            window.setTimeout(() => setInputValue(value), 0)
          }}
        />
        <ComboboxContent>
          <ComboboxEmpty>
            {searching ? "Google Maps'te aranıyor…" : inputValue.trim().length < 2 ? "En az 2 karakter yazın" : "Adres seçeneği bulunamadı"}
          </ComboboxEmpty>
          <ComboboxList>
            {(option: GoogleAddressOption) => (
              <ComboboxItem key={option.id} value={option}>
                <MapPin className="size-4 shrink-0 text-primary" />
                <span className="whitespace-normal">{option.label}</span>
              </ComboboxItem>
            )}
          </ComboboxList>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">Google Maps sonuçları</p>
        </ComboboxContent>
      </Combobox>
      {error && <p className="text-sm text-destructive-strong">{error}</p>}
    </div>
  )
}

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
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    onMoveRef.current = onMove
  }, [onMove])

  useEffect(() => {
    let cancelled = false
    const listeners: google.maps.MapsEventListener[] = []

    async function initialize() {
      try {
        await reserveSalesGoogleMapsUsage("dynamic_maps")
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
      } catch (error) {
        if (!cancelled) {
          setLoadError(googleMapsClientErrorMessage(error, "Google Maps yapılandırmasını kontrol edip tekrar deneyin."))
        }
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
    if (!map || !marker) return
    if (!coordinates) {
      marker.map = null
      map.setCenter({ lat: 39.1, lng: 35.2 })
      map.setZoom(5)
      return
    }
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
        <AlertDescription>{loadError}</AlertDescription>
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
  const city = useWatch({ control: form.control, name: "city" })
  const district = useWatch({ control: form.control, name: "district" })
  const neighborhood = useWatch({ control: form.control, name: "neighborhood" })
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
  const [placesLibrary, setPlacesLibrary] = useState<google.maps.PlacesLibrary | null>(null)
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)
  const newestRequestRef = useRef(0)

  const configured = Boolean(apiKey && mapId)
  const coordinates = latitude != null && longitude != null ? { latitude, longitude } : null

  useEffect(() => {
    if (!apiKey || !mapId) return
    let cancelled = false
    void loadSalesGoogleLibrary(apiKey, mapId, "places")
      .then((library) => {
        if (!cancelled) setPlacesLibrary(library)
      })
      .catch(() => {
        if (!cancelled) setMapsError("Google Places yüklenemedi. API anahtarı ve etkin servisleri kontrol edin.")
      })
    return () => { cancelled = true }
  }, [apiKey, mapId])

  useEffect(() => {
    if (!configured || !queryTouched || !query || query.trim().length < 3 || !placesLibrary) {
      return
    }

    const requestId = ++newestRequestRef.current
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true)
        sessionTokenRef.current ??= new placesLibrary.AutocompleteSessionToken()
        await reserveSalesGoogleMapsUsage("autocomplete_requests")
        const result = await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          includedRegionCodes: ["tr"],
          language: "tr",
          region: "tr",
          sessionToken: sessionTokenRef.current,
        })
        if (requestId !== newestRequestRef.current) return
        setSuggestions(result.suggestions.flatMap((suggestion) => suggestion.placePrediction ? [suggestion.placePrediction] : []))
        setMapsError(null)
      } catch (requestError) {
        if (requestId === newestRequestRef.current) {
          setSuggestions([])
          setMapsError(googleMapsClientErrorMessage(
            requestError,
            "İşletme ve adres önerileri alınamadı. Birkaç saniye sonra tekrar deneyin.",
          ))
        }
      } finally {
        if (requestId === newestRequestRef.current) setSearching(false)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [configured, placesLibrary, query, queryTouched])

  function clearResolvedLocation({ keepCoordinates = false }: { keepCoordinates?: boolean } = {}) {
    const hasCoordinates = keepCoordinates && form.getValues("latitude") != null && form.getValues("longitude") != null
    form.setValue("googlePlaceId", "", { shouldDirty: true })
    form.setValue("formattedAddress", "", { shouldDirty: true })
    if (!hasCoordinates) {
      form.setValue("latitude", null, { shouldDirty: true })
      form.setValue("longitude", null, { shouldDirty: true })
      setShowMap(false)
    }
    form.setValue("locationSource", hasCoordinates ? "manual_pin" : null, { shouldDirty: true })
    form.setValue("locationConfirmed", false, { shouldDirty: true, shouldValidate: true })
  }

  function clearDependentAddress(level: "city" | "district" | "neighborhood") {
    if (level === "city") form.setValue("district", "", { shouldDirty: true, shouldValidate: true })
    if (level === "city" || level === "district") {
      form.setValue("neighborhood", "", { shouldDirty: true })
    }
    form.setValue("route", "", { shouldDirty: true })
    form.setValue("streetNumber", "", { shouldDirty: true })
    form.setValue("postalCode", "", { shouldDirty: true })
    form.setValue("address", "", { shouldDirty: true })
    clearResolvedLocation()
  }

  function updateAddressSummary(next: Partial<Pick<ParsedSalesAddress, "neighborhood" | "route" | "streetNumber">>) {
    form.setValue("address", composeSalesAddress({
      neighborhood: next.neighborhood ?? form.getValues("neighborhood"),
      route: next.route ?? form.getValues("route"),
      streetNumber: next.streetNumber ?? form.getValues("streetNumber"),
    }), { shouldDirty: true })
  }

  function selectAddressComponent(kind: GoogleAddressComponentKind, selection: GoogleAddressSelection) {
    if (kind === "neighborhood") {
      form.setValue("neighborhood", selection.value, { shouldDirty: true, shouldValidate: true })
      form.setValue("route", "", { shouldDirty: true })
      form.setValue("streetNumber", "", { shouldDirty: true })
      form.setValue("postalCode", selection.parsed.postalCode, { shouldDirty: true })
      updateAddressSummary({ neighborhood: selection.value, route: "", streetNumber: "" })
    } else {
      form.setValue("route", selection.value, { shouldDirty: true, shouldValidate: true })
      form.setValue("streetNumber", "", { shouldDirty: true })
      form.setValue(
        "postalCode",
        selection.parsed.postalCode || form.getValues("postalCode"),
        { shouldDirty: true },
      )
      updateAddressSummary({ route: selection.value, streetNumber: "" })
    }

    form.setValue("googlePlaceId", "", { shouldDirty: true })
    form.setValue("formattedAddress", selection.formattedAddress, { shouldDirty: true })
    if (selection.coordinates) {
      form.setValue("latitude", selection.coordinates.latitude, { shouldDirty: true })
      form.setValue("longitude", selection.coordinates.longitude, { shouldDirty: true })
      form.setValue("locationSource", "manual_pin", { shouldDirty: true })
      setShowMap(true)
    } else {
      form.setValue("latitude", null, { shouldDirty: true })
      form.setValue("longitude", null, { shouldDirty: true })
      form.setValue("locationSource", null, { shouldDirty: true })
    }
    form.setValue("locationConfirmed", false, { shouldDirty: true, shouldValidate: true })
  }

  async function selectPrediction(prediction: google.maps.places.PlacePrediction) {
    try {
      setSelecting(true)
      const place = prediction.toPlace()
      await reserveSalesGoogleMapsUsage("place_details_essentials")
      await place.fetchFields({
        fields: ["id", "formattedAddress", "addressComponents", "location", "viewport"],
      })
      if (!place.location) {
        setMapsError("Seçilen sonuç için harita konumu bulunamadı.")
        return
      }

      const parsed = parseTurkishSalesAddress(place.addressComponents ?? [])
      const formattedAddress = place.formattedAddress ?? prediction.text.toString()
      const businessName = prediction.mainText?.toString().trim() || prediction.text.toString().trim()
      form.setValue("placeSearch", businessName || formattedAddress, { shouldDirty: true })
      if (businessName) form.setValue("businessName", businessName, { shouldDirty: true, shouldValidate: true })
      const canonicalCity = canonicalizeTurkishCity(parsed.city)
      const canonicalDistrict = canonicalizeTurkishDistrict(canonicalCity, parsed.district)
      form.setValue("city", canonicalCity, { shouldDirty: true })
      form.setValue("district", canonicalDistrict, { shouldDirty: true })
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
    } catch (selectionError) {
      setMapsError(googleMapsClientErrorMessage(
        selectionError,
        "Seçilen işletmenin konum ayrıntıları alınamadı.",
      ))
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

  return (
    <div className="space-y-3 sm:col-span-2">
      {configured ? (
        <>
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
                        setSuggestions([])
                        if (event.target.value.trim().length < 3) {
                          newestRequestRef.current += 1
                          setSearching(false)
                        }
                        if (form.getValues("locationSource") || form.getValues("formattedAddress")) {
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
        </>
      ) : (
        <Alert>
          <MapPin className="size-4" />
          <AlertTitle>Google konum doğrulaması yapılandırılmadı</AlertTitle>
          <AlertDescription>
            İl ve ilçe seçilebilir; Google Maps anahtarı tanımlanana kadar mahalle, cadde/sokak ve harita doğrulaması kullanılamaz.
          </AlertDescription>
        </Alert>
      )}

      {mapsError && (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertDescription>{mapsError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>İl</FormLabel>
              <FormControl>
                <CitySelect
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={(next) => {
                    if (next === field.value) return
                    field.onChange(next)
                    clearDependentAddress("city")
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="district"
          render={({ field }) => (
            <FormItem>
              <FormLabel>İlçe</FormLabel>
              <FormControl>
                <DistrictSelect
                  city={city}
                  value={field.value}
                  onBlur={field.onBlur}
                  onValueChange={(next) => {
                    if (next === field.value) return
                    field.onChange(next)
                    clearDependentAddress("district")
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="neighborhood"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mahalle</FormLabel>
              <GoogleAddressComponentCombobox
                key={`neighborhood:${city}:${district}:${field.value}`}
                apiKey={apiKey}
                mapId={mapId}
                kind="neighborhood"
                city={city}
                district={district}
                value={field.value}
                disabled={!configured || !city || !district}
                onBlur={field.onBlur}
                onClear={() => {
                  field.onChange("")
                  clearDependentAddress("neighborhood")
                }}
                onSelect={(selection) => selectAddressComponent("neighborhood", selection)}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="route"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cadde / sokak</FormLabel>
              <GoogleAddressComponentCombobox
                key={`route:${city}:${district}:${neighborhood}:${field.value}`}
                apiKey={apiKey}
                mapId={mapId}
                kind="route"
                city={city}
                district={district}
                neighborhood={neighborhood}
                value={field.value}
                disabled={!configured || !city || !district || !neighborhood}
                onBlur={field.onBlur}
                onClear={() => clearDependentAddress("neighborhood")}
                onSelect={(selection) => selectAddressComponent("route", selection)}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="streetNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dış kapı no</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(event) => {
                    field.onChange(event)
                    updateAddressSummary({ streetNumber: event.target.value })
                    clearResolvedLocation({ keepCoordinates: true })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="postalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Posta kodu</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(event) => {
                    field.onChange(event)
                    clearResolvedLocation({ keepCoordinates: true })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Adres özeti / tarif</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={2}
                  onChange={(event) => {
                    field.onChange(event)
                    clearResolvedLocation({ keepCoordinates: true })
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {configured && <div className="flex flex-wrap items-center gap-2">
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
      </div>}

      {showMap && apiKey && mapId && (
        <LocationPreviewMap apiKey={apiKey} mapId={mapId} coordinates={coordinates} onMove={moveLocation} />
      )}

      {coordinates && !confirmed && (
        <p className="text-xs font-medium text-warning-strong">Portföye eklemeden önce haritadaki konumu doğrulayın.</p>
      )}
    </div>
  )
}
