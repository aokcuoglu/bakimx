import { PHOTO_TYPES } from "@/lib/constants"

export type PhotoCompletionResult = {
  total: number
  completed: number
  required: number
  requiredCompleted: number
  percentage: number
  missing: string[]
  missingLabels: string[]
}

export function calculatePhotoCompletion(
  existingPhotoTypes: string[]
): PhotoCompletionResult {
  const allTypes = Object.entries(PHOTO_TYPES)
  const requiredTypes = allTypes.filter(([, v]) => v.required)
  const takenSet = new Set(existingPhotoTypes)

  const completed = allTypes.filter(([key]) => takenSet.has(key)).length
  const requiredCompleted = requiredTypes.filter(([key]) => takenSet.has(key)).length
  const missing = requiredTypes.filter(([key]) => !takenSet.has(key)).map(([key]) => key)
  const missingLabels = missing.map((key) => PHOTO_TYPES[key as keyof typeof PHOTO_TYPES]?.label || key)

  return {
    total: allTypes.length,
    completed,
    required: requiredTypes.length,
    requiredCompleted,
    percentage: requiredTypes.length > 0 ? Math.round((requiredCompleted / requiredTypes.length) * 100) : 0,
    missing,
    missingLabels,
  }
}

export type PhotoPhaseGroup = {
  phase: string
  label: string
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string }[]
}

export function groupPhotosByPhase(
  photos: { id: string; type: string; label: string; fileUrl: string | null; phase: string }[]
): PhotoPhaseGroup[] {
  const phaseLabels: Record<string, string> = {
    intake: "Kabul Fotoğrafları",
    repair_progress: "Onarım Aşaması",
    delivery: "Teslim Fotoğrafları",
  }

  const groupMap = new Map<string, PhotoPhaseGroup["photos"]>()
  const phaseOrder = ["intake", "repair_progress", "delivery"]

  for (const photo of photos) {
    const phase = photo.phase || "intake"
    if (!groupMap.has(phase)) groupMap.set(phase, [])
    groupMap.get(phase)!.push(photo)
  }

  const result: PhotoPhaseGroup[] = []
  for (const phase of phaseOrder) {
    const phasePhotos = groupMap.get(phase)
    if (phasePhotos && phasePhotos.length > 0) {
      result.push({
        phase,
        label: phaseLabels[phase] || phase,
        photos: phasePhotos,
      })
    }
  }

  const otherPhases = Array.from(groupMap.keys()).filter((p) => !phaseOrder.includes(p))
  for (const phase of otherPhases) {
    result.push({
      phase,
      label: phaseLabels[phase] || phase,
      photos: groupMap.get(phase)!,
    })
  }

  return result
}