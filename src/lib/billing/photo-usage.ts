import type { Prisma } from "@prisma/client"

/** The upload quota counts all active photos attached to the intake, including purchase evidence. */
export function photoUsageWhere(workshopId: string, intakeFormIds: string[]): Prisma.VehiclePhotoWhereInput {
  return { workshopId, intakeFormId: { in: intakeFormIds }, deletedAt: null }
}
