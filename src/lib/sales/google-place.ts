import { normalizePartSearchTerm } from "@/lib/tr-search"

export type SalesPlaceAddressComponent = {
  longText: string | null
  shortText?: string | null
  types: readonly string[]
}

export type SalesPlaceSelection = {
  placeId: string
  businessName: string
  formattedAddress: string
  city: string
  district: string
  neighborhood: string
  route: string
  streetNumber: string
  postalCode: string
  latitude: number
  longitude: number
}

export type ParsedSalesAddress = Pick<
  SalesPlaceSelection,
  "city" | "district" | "neighborhood" | "route" | "streetNumber" | "postalCode"
> & { address: string }

function component(
  components: readonly SalesPlaceAddressComponent[],
  ...types: string[]
): string {
  return components.find((item) => types.some((type) => item.types.includes(type)))?.longText?.trim() ?? ""
}

function normalizeStreetNumber(value: string): string {
  return value.replace(/^no\.?\s*:?\s*/iu, "").trim()
}

/**
 * Google adres bileşenleri ülkeye ve kaydın ayrıntı düzeyine göre değişebilir.
 * Türkiye için il/ilçe/mahalle sırasını korurken aynı sublocality değerini iki
 * ayrı alana yazmayan deterministik bir eşleme uygular.
 */
export function parseTurkishSalesAddress(
  components: readonly SalesPlaceAddressComponent[],
): ParsedSalesAddress {
  const city = component(components, "administrative_area_level_1")
  const administrativeDistrict = component(components, "administrative_area_level_2")
  const sublocalityLevel1 = component(components, "sublocality_level_1", "sublocality")
  const district = administrativeDistrict || sublocalityLevel1
  const neighborhood = component(
    components,
    "neighborhood",
    "sublocality_level_2",
    "administrative_area_level_4",
  )
    || (administrativeDistrict ? sublocalityLevel1 : "")
  const route = component(components, "route")
  const streetNumber = normalizeStreetNumber(component(components, "street_number"))
  const postalCode = component(components, "postal_code")
  const routeWithNumber = route && streetNumber ? `${route} No: ${streetNumber}` : route || streetNumber

  return {
    city,
    district,
    neighborhood,
    route,
    streetNumber,
    postalCode,
    address: [neighborhood, routeWithNumber].filter(Boolean).join(", "),
  }
}

export function composeSalesAddress({
  neighborhood,
  route,
  streetNumber,
}: Pick<ParsedSalesAddress, "neighborhood" | "route" | "streetNumber">): string {
  const routeWithNumber = route && streetNumber ? `${route} No: ${streetNumber}` : route || streetNumber
  return [neighborhood, routeWithNumber].filter(Boolean).join(", ")
}

function matchesAddressPart(componentValue: string, expectedValue: string, formattedAddress: string): boolean {
  const expected = normalizePartSearchTerm(expectedValue)
  if (!expected) return false
  const component = normalizePartSearchTerm(componentValue)
  if (component) return component === expected
  return normalizePartSearchTerm(formattedAddress).includes(expected)
}

/** Google önerisinin kullanıcının seçtiği il ve ilçenin içinde kaldığını doğrular. */
export function matchesSelectedTurkishArea(
  parsed: Pick<ParsedSalesAddress, "city" | "district">,
  formattedAddress: string,
  selectedCity: string,
  selectedDistrict: string,
): boolean {
  return matchesAddressPart(parsed.city, selectedCity, formattedAddress)
    && matchesAddressPart(parsed.district, selectedDistrict, formattedAddress)
}
