import type { BodyType } from "./vehicle-geometry"

/**
 * 3D damage models built by scripts/models/build-damage-model.ts. Both sources are CC BY 4.0,
 * so the credit below must stay visible wherever the model is shown.
 */
export const VEHICLE_3D_MODELS = {
  suv: {
    url: "/models/damage/suv.glb",
    credit: {
      title: "MMC Generic Small SUV Car",
      author: "MMC Works",
      source: "https://sketchfab.com/3d-models/mmc-generic-small-suv-car-5db696c6ed5d4bdc87905c1040fa072a",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
} as const

export type Vehicle3DModel = keyof typeof VEHICLE_3D_MODELS

/** Light commercial vehicles reuse the passenger model until a dedicated van model exists. */
export function modelForBody(body: BodyType): Vehicle3DModel | null {
  if (body === "unsupported") return null
  return "suv"
}
