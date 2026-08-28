import { TR_CITIES } from "@/lib/tr-cities"

export type TerritoryCoordinates = { latitude: number; longitude: number }

/**
 * Approximate city-centre coordinates used to place sales leads on the map.
 * A lead without a recognisable Turkish city remains unplaced rather than
 * being assigned a misleading fallback location.
 */
export const TURKEY_CITY_COORDINATES = {
  Adana: { latitude: 37, longitude: 35.3213 },
  Adıyaman: { latitude: 37.7648, longitude: 38.2786 },
  Afyonkarahisar: { latitude: 38.7569, longitude: 30.5387 },
  Ağrı: { latitude: 39.7191, longitude: 43.0503 },
  Aksaray: { latitude: 38.3687, longitude: 34.037 },
  Amasya: { latitude: 40.6539, longitude: 35.8331 },
  Ankara: { latitude: 39.9334, longitude: 32.8597 },
  Antalya: { latitude: 36.8969, longitude: 30.7133 },
  Ardahan: { latitude: 41.1105, longitude: 42.7022 },
  Artvin: { latitude: 41.1828, longitude: 41.8183 },
  Aydın: { latitude: 37.845, longitude: 27.8396 },
  Balıkesir: { latitude: 39.6484, longitude: 27.8826 },
  Bartın: { latitude: 41.6358, longitude: 32.3375 },
  Batman: { latitude: 37.8812, longitude: 41.1351 },
  Bayburt: { latitude: 40.2552, longitude: 40.2249 },
  Bilecik: { latitude: 40.1501, longitude: 29.9831 },
  Bingöl: { latitude: 38.8854, longitude: 40.498 },
  Bitlis: { latitude: 38.4006, longitude: 42.1095 },
  Bolu: { latitude: 40.7395, longitude: 31.6116 },
  Burdur: { latitude: 37.7203, longitude: 30.2908 },
  Bursa: { latitude: 40.195, longitude: 29.06 },
  Çanakkale: { latitude: 40.1553, longitude: 26.4142 },
  Çankırı: { latitude: 40.6013, longitude: 33.6134 },
  Çorum: { latitude: 40.5506, longitude: 34.9556 },
  Denizli: { latitude: 37.7765, longitude: 29.0864 },
  Diyarbakır: { latitude: 37.9144, longitude: 40.2306 },
  Düzce: { latitude: 40.8438, longitude: 31.1565 },
  Edirne: { latitude: 41.6771, longitude: 26.5557 },
  Elazığ: { latitude: 38.6748, longitude: 39.2225 },
  Erzincan: { latitude: 39.75, longitude: 39.5 },
  Erzurum: { latitude: 39.9043, longitude: 41.2679 },
  Eskişehir: { latitude: 39.7767, longitude: 30.5206 },
  Gaziantep: { latitude: 37.0662, longitude: 37.3833 },
  Giresun: { latitude: 40.9128, longitude: 38.3895 },
  Gümüşhane: { latitude: 40.4603, longitude: 39.4814 },
  Hakkâri: { latitude: 37.5744, longitude: 43.7408 },
  Hatay: { latitude: 36.2021, longitude: 36.1604 },
  Iğdır: { latitude: 39.9237, longitude: 44.045 },
  Isparta: { latitude: 37.7648, longitude: 30.5566 },
  İstanbul: { latitude: 41.0082, longitude: 28.9784 },
  İzmir: { latitude: 38.4237, longitude: 27.1428 },
  Kahramanmaraş: { latitude: 37.5753, longitude: 36.9228 },
  Karabük: { latitude: 41.2061, longitude: 32.6204 },
  Karaman: { latitude: 37.1759, longitude: 33.2287 },
  Kars: { latitude: 40.6013, longitude: 43.0975 },
  Kastamonu: { latitude: 41.3887, longitude: 33.7827 },
  Kayseri: { latitude: 38.7225, longitude: 35.4875 },
  Kırıkkale: { latitude: 39.8398, longitude: 33.5089 },
  Kırklareli: { latitude: 41.7351, longitude: 27.2252 },
  Kırşehir: { latitude: 39.1458, longitude: 34.1607 },
  Kilis: { latitude: 36.7184, longitude: 37.1212 },
  Kocaeli: { latitude: 40.7654, longitude: 29.9408 },
  Konya: { latitude: 37.8746, longitude: 32.4932 },
  Kütahya: { latitude: 39.4192, longitude: 29.9857 },
  Malatya: { latitude: 38.3552, longitude: 38.3095 },
  Manisa: { latitude: 38.6191, longitude: 27.4289 },
  Mardin: { latitude: 37.3212, longitude: 40.7245 },
  Mersin: { latitude: 36.8121, longitude: 34.6415 },
  Muğla: { latitude: 37.2153, longitude: 28.3636 },
  Muş: { latitude: 38.9462, longitude: 41.7539 },
  Nevşehir: { latitude: 38.6247, longitude: 34.7142 },
  Niğde: { latitude: 37.9698, longitude: 34.6766 },
  Ordu: { latitude: 40.9839, longitude: 37.8764 },
  Osmaniye: { latitude: 37.0742, longitude: 36.2478 },
  Rize: { latitude: 41.0201, longitude: 40.5234 },
  Sakarya: { latitude: 40.7569, longitude: 30.3781 },
  Samsun: { latitude: 41.2867, longitude: 36.33 },
  Siirt: { latitude: 37.933, longitude: 41.95 },
  Sinop: { latitude: 42.0264, longitude: 35.1551 },
  Sivas: { latitude: 39.7477, longitude: 37.0179 },
  Şanlıurfa: { latitude: 37.1674, longitude: 38.7955 },
  Şırnak: { latitude: 37.5164, longitude: 42.4611 },
  Tekirdağ: { latitude: 40.9781, longitude: 27.5117 },
  Tokat: { latitude: 40.3167, longitude: 36.55 },
  Trabzon: { latitude: 41.0027, longitude: 39.7168 },
  Tunceli: { latitude: 39.1079, longitude: 39.5401 },
  Uşak: { latitude: 38.6823, longitude: 29.4082 },
  Van: { latitude: 38.4891, longitude: 43.4089 },
  Yalova: { latitude: 40.65, longitude: 29.2667 },
  Yozgat: { latitude: 39.8181, longitude: 34.8147 },
  Zonguldak: { latitude: 41.4564, longitude: 31.7987 },
} satisfies Record<(typeof TR_CITIES)[number], TerritoryCoordinates>

function normalizeCity(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[çğıöşü]/g, (letter) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[letter] ?? letter)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const CITY_LOOKUP = TR_CITIES.map((city) => ({ city, normalized: normalizeCity(city) }))

export function territoryCoordinatesForCity(city: string | null): TerritoryCoordinates | null {
  if (!city) return null
  const normalized = normalizeCity(city)
  const match = CITY_LOOKUP.find(({ normalized: candidate }) =>
    normalized === candidate || normalized.startsWith(`${candidate} `) || normalized.endsWith(` ${candidate}`)
  )
  return match ? TURKEY_CITY_COORDINATES[match.city] : null
}
