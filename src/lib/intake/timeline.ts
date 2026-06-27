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
  | "intake_details_edited"
  | "delivery_output_generated"
  | "technician_assigned"
  | "technician_unassigned"
  | "work_started"
  | "work_on_hold"
  | "work_completed"
  | "parts_requested"
  | "parts_request_updated"
  | "repair_photo_added"
  | "checklist_item_completed"
  | "internal_note_added"
  | "labor_session_started"
  | "labor_session_stopped"

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