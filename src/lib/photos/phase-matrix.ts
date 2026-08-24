import {
  DAMAGE_PHOTO_TYPE,
  PHOTO_PHASE_ORDER,
  PHOTO_TYPES,
  VEHICLE_PHOTO_TYPES,
  type PhotoPhaseKey,
  type PhotoTypeKey,
  type VehiclePhotoTypeKey,
} from "@/lib/constants"

export type PhaseMatrixPhoto = {
  id: string
  type: string
  phase: string
  fileUrl: string | null
  note?: string | null
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
}

export type PhaseMatrixCell = {
  phase: PhotoPhaseKey
  photos: PhaseMatrixPhoto[]
}

export type PhaseMatrixRow = {
  type: VehiclePhotoTypeKey
  label: string
  required: boolean
  cells: PhaseMatrixCell[]
}

export function isDamagePhotoType(type: string): boolean {
  return type === DAMAGE_PHOTO_TYPE
}

export function isVehiclePhotoType(type: string): type is VehiclePhotoTypeKey {
  return type in VEHICLE_PHOTO_TYPES
}

export function partitionIntakePhotos<T extends { type: string }>(photos: T[]): {
  vehicle: T[]
  damage: T[]
} {
  const vehicle: T[] = []
  const damage: T[] = []
  for (const photo of photos) {
    if (isDamagePhotoType(photo.type)) damage.push(photo)
    else vehicle.push(photo)
  }
  return { vehicle, damage }
}

function normalizePhase(phase: string | null | undefined): PhotoPhaseKey {
  if (phase === "repair_progress" || phase === "delivery" || phase === "intake") return phase
  return "intake"
}

/**
 * Araç fotoğraflarını tip satırı × aşama hücresi matrisine çevirir.
 * Zorunlu tipler her zaman satırda; opsiyoneller yalnızca en az bir karesi varsa.
 */
export function buildPhotoPhaseMatrix(photos: PhaseMatrixPhoto[]): PhaseMatrixRow[] {
  const byType = new Map<string, PhaseMatrixPhoto[]>()
  for (const photo of photos) {
    if (!isVehiclePhotoType(photo.type)) continue
    const list = byType.get(photo.type) ?? []
    list.push(photo)
    byType.set(photo.type, list)
  }

  const typeKeys = Object.keys(VEHICLE_PHOTO_TYPES) as VehiclePhotoTypeKey[]
  const rows: PhaseMatrixRow[] = []

  for (const type of typeKeys) {
    const meta = PHOTO_TYPES[type as PhotoTypeKey]
    const typePhotos = byType.get(type) ?? []
    if (!meta.required && typePhotos.length === 0) continue

    const cells: PhaseMatrixCell[] = PHOTO_PHASE_ORDER.map((phase) => ({
      phase,
      photos: typePhotos.filter((p) => normalizePhase(p.phase) === phase),
    }))

    rows.push({
      type,
      label: meta.label,
      required: meta.required,
      cells,
    })
  }

  return rows
}

/** Aynı tipte aşama sırasına göre düz liste (lightbox gezintisi). */
export function flattenTypeAcrossPhases(row: PhaseMatrixRow): PhaseMatrixPhoto[] {
  return row.cells.flatMap((cell) => cell.photos)
}

/** Üç aşamanın kapak kareleri (zoom carousel: Kabul → Onarım → Teslim). */
export function phaseCoverSlides(row: PhaseMatrixRow): {
  phase: PhotoPhaseKey
  photo: PhaseMatrixPhoto
}[] {
  const slides: { phase: PhotoPhaseKey; photo: PhaseMatrixPhoto }[] = []
  for (const cell of row.cells) {
    const cover = cell.photos.find((p) => p.fileUrl)
    if (!cover?.fileUrl) continue
    slides.push({ phase: cell.phase, photo: cover })
  }
  return slides
}

export function countFilledPhases(row: PhaseMatrixRow): number {
  return row.cells.filter((c) => c.photos.some((p) => p.fileUrl)).length
}
