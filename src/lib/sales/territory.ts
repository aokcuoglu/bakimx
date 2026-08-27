import { TR_CITIES } from "@/lib/tr-cities"

export type TerritoryPosition = { x: number; y: number }

/**
 * Lightweight city-centre projection for the operations overview. Coordinates
 * are percentages inside the custom Turkey silhouette; no external map service,
 * tracking SDK or customer address is sent off-platform.
 */
export const TURKEY_CITY_POSITIONS = {
  Adana: { x: 52, y: 62 }, Adıyaman: { x: 66, y: 56 }, Afyonkarahisar: { x: 30, y: 48 },
  Ağrı: { x: 91, y: 38 }, Aksaray: { x: 44, y: 50 }, Amasya: { x: 58, y: 26 },
  Ankara: { x: 43, y: 39 }, Antalya: { x: 29, y: 69 }, Ardahan: { x: 87, y: 21 },
  Artvin: { x: 84, y: 17 }, Aydın: { x: 15, y: 53 }, Balıkesir: { x: 16, y: 36 },
  Bartın: { x: 42, y: 18 }, Batman: { x: 80, y: 54 }, Bayburt: { x: 78, y: 29 },
  Bilecik: { x: 29, y: 35 }, Bingöl: { x: 78, y: 40 }, Bitlis: { x: 88, y: 49 },
  Bolu: { x: 38, y: 30 }, Burdur: { x: 28, y: 60 }, Bursa: { x: 24, y: 33 },
  Çanakkale: { x: 9, y: 34 }, Çankırı: { x: 47, y: 30 }, Çorum: { x: 54, y: 27 },
  Denizli: { x: 22, y: 54 }, Diyarbakır: { x: 75, y: 54 }, Düzce: { x: 34, y: 27 },
  Edirne: { x: 9, y: 26 }, Elazığ: { x: 70, y: 46 }, Erzincan: { x: 72, y: 33 },
  Erzurum: { x: 84, y: 32 }, Eskişehir: { x: 34, y: 39 }, Gaziantep: { x: 60, y: 64 },
  Giresun: { x: 71, y: 20 }, Gümüşhane: { x: 74, y: 26 }, Hakkâri: { x: 91, y: 65 },
  Hatay: { x: 57, y: 76 }, Iğdır: { x: 95, y: 31 }, Isparta: { x: 30, y: 56 },
  İstanbul: { x: 22, y: 24 }, İzmir: { x: 10, y: 47 }, Kahramanmaraş: { x: 60, y: 52 },
  Karabük: { x: 42, y: 25 }, Karaman: { x: 38, y: 62 }, Kars: { x: 90, y: 27 },
  Kastamonu: { x: 49, y: 18 }, Kayseri: { x: 54, y: 46 }, Kırıkkale: { x: 47, y: 38 },
  Kırklareli: { x: 16, y: 18 }, Kırşehir: { x: 48, y: 43 }, Kilis: { x: 59, y: 69 },
  Kocaeli: { x: 28, y: 29 }, Konya: { x: 37, y: 52 }, Kütahya: { x: 28, y: 40 },
  Malatya: { x: 66, y: 48 }, Manisa: { x: 15, y: 45 }, Mardin: { x: 77, y: 62 },
  Mersin: { x: 46, y: 66 }, Muğla: { x: 16, y: 63 }, Muş: { x: 84, y: 44 },
  Nevşehir: { x: 48, y: 48 }, Niğde: { x: 48, y: 56 }, Ordu: { x: 67, y: 20 },
  Osmaniye: { x: 57, y: 60 }, Rize: { x: 80, y: 19 }, Sakarya: { x: 31, y: 28 },
  Samsun: { x: 62, y: 17 }, Siirt: { x: 84, y: 55 }, Sinop: { x: 55, y: 12 },
  Sivas: { x: 62, y: 37 }, Şanlıurfa: { x: 69, y: 61 }, Şırnak: { x: 84, y: 63 },
  Tekirdağ: { x: 17, y: 29 }, Tokat: { x: 62, y: 29 }, Trabzon: { x: 76, y: 20 },
  Tunceli: { x: 73, y: 41 }, Uşak: { x: 24, y: 47 }, Van: { x: 94, y: 50 },
  Yalova: { x: 24, y: 29 }, Yozgat: { x: 53, y: 37 }, Zonguldak: { x: 38, y: 21 },
} satisfies Record<(typeof TR_CITIES)[number], TerritoryPosition>

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

export function territoryPositionForCity(city: string | null): TerritoryPosition | null {
  if (!city) return null
  const normalized = normalizeCity(city)
  const match = CITY_LOOKUP.find(({ normalized: candidate }) =>
    normalized === candidate || normalized.startsWith(`${candidate} `) || normalized.endsWith(` ${candidate}`)
  )
  return match ? TURKEY_CITY_POSITIONS[match.city] : null
}
