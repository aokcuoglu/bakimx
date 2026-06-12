import { prisma } from "@/lib/db"

export type TimelineEventInput = {
  workshopId: string
  intakeFormId: string
  eventType: string
  description: string
}

export async function addTimelineEvent(input: TimelineEventInput): Promise<void> {
  await prisma.intakeTimelineEvent.create({
    data: {
      workshopId: input.workshopId,
      intakeFormId: input.intakeFormId,
      eventType: input.eventType,
      description: input.description,
    },
  })
}

export type TimelineEventType =
  | "intake_created"
  | "photos_uploaded"
  | "damage_marks_added"
  | "approval_requested"
  | "approval_verified"
  | "work_order_created"
  | "delivery_output_generated"

export async function getTimelineForIntake(intakeFormId: string) {
  return prisma.intakeTimelineEvent.findMany({
    where: { intakeFormId },
    orderBy: { createdAt: "asc" },
  })
}

export async function getTimelineForIntakePublic(intakeFormId: string) {
  const events = await prisma.intakeTimelineEvent.findMany({
    where: { intakeFormId },
    select: {
      eventType: true,
      description: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })
  return events
}