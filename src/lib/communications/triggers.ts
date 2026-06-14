import { sendCommunication } from "@/lib/communications"
import type { CommunicationType, TemplateVariables } from "@/lib/communications/types"

async function getWorkshopName(workshopId: string): Promise<string> {
  const { prisma } = await import("@/lib/db")
  const workshop = await prisma.workshop.findUnique({ where: { id: workshopId }, select: { name: true } })
  return workshop?.name || "BakimX"
}

function buildPortalLink(workshopId: string, token?: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000"
  if (token) return `${appUrl}/s/${token}`
  return appUrl
}

function buildPassportLink(token: string): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000"
  return `${appUrl}/p/${token}`
}

export async function notifyAppointmentCreated(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  appointmentDate: string,
  appointmentTime: string,
  appointmentNo?: string,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    appointmentDate,
    appointmentTime,
    portalLink: buildPortalLink(workshopId),
    customMessage: appointmentNo ? `Randevu No: ${appointmentNo}` : undefined,
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "appointment_created",
    variables,
    channels: ["sms", "whatsapp", "email"] as CommunicationType[],
    entityType: "appointment",
    entityId,
  })
}

export async function notifyAppointmentReminder(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  appointmentDate: string,
  appointmentTime: string,
  hoursBefore: number,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    appointmentDate,
    appointmentTime,
    portalLink: buildPortalLink(workshopId),
    customMessage: hoursBefore <= 1 ? "Randevunuza 1 saat kaldı!" : "Randevunuza 24 saat kaldı.",
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "appointment_reminder",
    variables,
    channels: ["sms", "whatsapp"] as CommunicationType[],
    entityType: "appointment",
    entityId,
  })
}

export async function notifyIntakeApproval(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  approvalToken: string,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    approvalLink: buildPortalLink(workshopId, approvalToken),
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "intake_approval",
    variables,
    channels: ["sms", "whatsapp"] as CommunicationType[],
    entityType: "intake",
    entityId,
  })
}

export async function notifyQuoteReady(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  quoteNo: string,
  totalAmount: string | null,
  shareToken?: string,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    quoteNo,
    totalAmount: totalAmount || "",
    portalLink: shareToken ? buildPortalLink(workshopId, shareToken) : buildPortalLink(workshopId),
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "quote_ready",
    variables,
    channels: ["sms", "whatsapp", "email"] as CommunicationType[],
    entityType: "quote",
    entityId,
  })
}

export async function notifyWorkOrderCompleted(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  workOrderNo: string,
  shareToken?: string,
  passportToken?: string,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    workOrderNo,
    portalLink: shareToken ? buildPortalLink(workshopId, shareToken) : buildPortalLink(workshopId),
    passportLink: passportToken ? buildPassportLink(passportToken) : undefined,
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "work_order_completed",
    variables,
    channels: ["sms", "whatsapp", "email"] as CommunicationType[],
    entityType: "order",
    entityId,
  })
}

export async function notifyMaintenanceReminder(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  maintenanceType: string,
  dueDate: string | null,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    maintenanceType,
    dueDate: dueDate || "",
    portalLink: buildPortalLink(workshopId),
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "maintenance_reminder",
    variables,
    channels: ["sms", "whatsapp", "email"] as CommunicationType[],
    entityType: "reminder",
    entityId,
  })
}

export async function notifyPaymentReminder(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  totalAmount: string,
  shareToken?: string,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    totalAmount,
    portalLink: shareToken ? buildPortalLink(workshopId, shareToken) : buildPortalLink(workshopId),
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "payment_reminder",
    variables,
    channels: ["sms", "whatsapp", "email"] as CommunicationType[],
    entityType: "order",
    entityId,
  })
}

export async function notifyVehiclePassportShare(
  workshopId: string,
  customerId: string,
  vehiclePlate: string | null,
  passportToken: string,
  entityId?: string,
) {
  const workshopName = await getWorkshopName(workshopId)
  const variables: TemplateVariables = {
    workshopName,
    vehiclePlate: vehiclePlate || "",
    passportLink: buildPassportLink(passportToken),
  }

  return sendCommunication({
    workshopId,
    customerId,
    templateKey: "vehicle_passport_share",
    variables,
    channels: ["sms", "whatsapp", "email"] as CommunicationType[],
    entityType: "vehicle",
    entityId,
  })
}