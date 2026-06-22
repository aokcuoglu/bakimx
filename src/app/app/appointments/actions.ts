"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { appointmentCreateSchema, appointmentStatusUpdateSchema } from "@/lib/validation"
import { getValidationError } from "@/lib/validation"
import { generateAppointmentNo, formatAppointmentNo } from "@/lib/work-order-number"
import { generateUniqueWorkOrderNo } from "@/lib/work-order-number"
import { AuditLogAction } from "@/lib/audit"
import { notifyAppointmentCreated } from "@/lib/communications/triggers"
import { syncAppointmentToCalendar } from "@/lib/calendar/sync"

export async function createAppointmentAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const raw: Record<string, unknown> = {}
  const fields = ["customerId", "vehicleId", "appointmentAt", "appointmentTime", "estimatedDurationMinutes", "title", "customerRequest", "internalNote", "reminderEnabled"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v && typeof v === "string" && v.trim()) raw[f] = v
  }

  const parsed = appointmentCreateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const { customerId, appointmentAt, appointmentTime, reminderEnabled, ...data } = parsed.data

  const customer = await prisma.customer.findFirst({ where: { id: customerId, workshopId } })
  if (!customer) return { error: "Müşteri bulunamadı" }

  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, workshopId, customerId } })
    if (!vehicle) return { error: "Araç bulunamadı veya müşteriyle eşleşmiyor" }
  }

  const appointmentDate = new Date(`${appointmentAt}T${appointmentTime}:00`)
  if (isNaN(appointmentDate.getTime())) return { error: "Geçersiz tarih/saat" }

  if (appointmentDate < new Date(new Date().toDateString())) {
    return { error: "Randevu tarihi geçmiş olamaz" }
  }

  const appointment = await prisma.appointment.create({
    data: {
      workshopId,
      customerId,
      vehicleId: data.vehicleId || null,
      appointmentNo: generateAppointmentNo(),
      appointmentAt: appointmentDate,
      estimatedDurationMinutes: data.estimatedDurationMinutes ? Number(data.estimatedDurationMinutes) : null,
      title: data.title || null,
      customerRequest: data.customerRequest || null,
      internalNote: data.internalNote || null,
      reminderStatus: reminderEnabled ? "pending" : "none",
      status: "scheduled",
    },
  })

  await AuditLogAction(workshopId, user.id, "Appointment", appointment.id, "appointment_created")

  try {
    await notifyAppointmentCreated(
      workshopId,
      customerId,
      data.vehicleId || null,
      appointmentAt,
      appointmentTime,
      appointment.appointmentNo || formatAppointmentNo(appointment),
      appointment.id,
    )
  } catch (e) {
    console.error("[notifyAppointmentCreated] Randevu bildirimi gönderilemedi:", e)
  }

  try {
    await syncAppointmentToCalendar(appointment.id, workshopId)
  } catch (e) {
    console.error("[syncAppointmentToCalendar] Takvim senkronizasyonu başarısız:", e)
  }

  revalidatePath("/app/appointments")
  return { success: true, id: appointment.id, appointmentNo: appointment.appointmentNo || formatAppointmentNo(appointment) }
}

export async function updateAppointmentStatusAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId
  const appointmentId = formData.get("appointmentId") as string
  const newStatus = formData.get("status") as string

  if (!appointmentId || !newStatus) return { error: "Eksik parametre" }

  const parsed = appointmentStatusUpdateSchema.safeParse({ status: newStatus })
  if (!parsed.success) return { error: getValidationError(parsed) }

  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, workshopId } })
  if (!appointment) return { error: "Randevu bulunamadı" }

  if (appointment.status === "converted") return { error: "İş emrine çevrilmiş randevunun durumu değiştirilemez" }
  if (appointment.status === "cancelled") return { error: "İptal edilmiş randevunun durumu değiştirilemez" }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: parsed.data.status },
  })

  await AuditLogAction(workshopId, user.id, "Appointment", appointmentId, `appointment_status_${parsed.data.status}`)
  revalidatePath(`/app/appointments/${appointmentId}`)
  revalidatePath("/app/appointments")
  return { success: true }
}

export async function convertAppointmentToWorkOrderAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId
  const appointmentId = formData.get("appointmentId") as string
  if (!appointmentId) return { error: "Randevu ID gerekli" }

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, workshopId },
  })
  if (!appointment) return { error: "Randevu bulunamadı" }
  if (appointment.status === "converted") return { error: "Bu randevu zaten iş emrine çevrilmiş" }
  if (appointment.status === "cancelled") return { error: "İptal edilmiş randevu iş emrine çevrilemez" }

  const customer = await prisma.customer.findFirst({ where: { id: appointment.customerId, workshopId } })
  if (!customer) return { error: "Müşteri bulunamadı" }

  const resolvedVehicleId = appointment.vehicleId
    ? (await prisma.vehicle.findFirst({ where: { id: appointment.vehicleId, workshopId } }))?.id ?? null
    : await getFirstVehicle(workshopId, appointment.customerId)

  if (!resolvedVehicleId) {
    return { error: "Dönüştürme için müşteriye ait bir araç bulunamadı" }
  }

  const order = await prisma.$transaction(async (tx) => {
    const intake = await tx.vehicleIntakeForm.create({
      data: {
        workshopId,
        customerId: appointment.customerId,
        vehicleId: resolvedVehicleId,
        customerComplaint: appointment.customerRequest || "Randevudan dönüştürüldü",
        internalNote: appointment.internalNote || undefined,
        status: "draft",
      },
    })

    const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
      tx.serviceOrder
        .findFirst({ where: { workshopId, workOrderNo: candidate }, select: { id: true } })
        .then((clash) => clash !== null)
    )

    const createdOrder = await tx.serviceOrder.create({
      data: {
        workshopId,
        intakeFormId: intake.id,
        workOrderNo,
        status: "draft",
        notes: appointment.customerRequest || "Randevudan dönüştürüldü",
      },
    })

    await tx.appointment.update({
      where: { id: appointmentId },
      data: { status: "converted", convertedServiceOrderId: createdOrder.id },
    })

    return createdOrder
  })

  await AuditLogAction(workshopId, user.id, "Appointment", appointmentId, "appointment_converted_to_work_order")
  await AuditLogAction(workshopId, user.id, "ServiceOrder", order.id, "service_order_created_from_appointment")
  revalidatePath(`/app/appointments/${appointmentId}`)
  revalidatePath("/app/appointments")
  revalidatePath("/app/orders")
  return { success: true, orderId: order.id }
}

export async function getAppointmentsAction(search?: string, status?: string, dateFilter?: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const where: Record<string, unknown> = { workshopId }

  if (status && status !== "all") where.status = status

  if (dateFilter && dateFilter !== "all") {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dateFilter === "today") {
      where.appointmentAt = { gte: today, lt: tomorrow }
    } else if (dateFilter === "tomorrow") {
      const dayAfter = new Date(tomorrow)
      dayAfter.setDate(dayAfter.getDate() + 1)
      where.appointmentAt = { gte: tomorrow, lt: dayAfter }
    } else if (dateFilter === "week") {
      const weekEnd = new Date(today)
      weekEnd.setDate(weekEnd.getDate() + 7)
      where.appointmentAt = { gte: today, lt: weekEnd }
    }
  }

  if (search) {
    where.OR = [
      { appointmentNo: { contains: search, mode: "insensitive" } },
      { customer: { phone: { contains: search } } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { fullName: { contains: search, mode: "insensitive" } } },
      { customer: { companyName: { contains: search, mode: "insensitive" } } },
      { vehicle: { plate: { contains: search, mode: "insensitive" } } },
    ]
  }

  const appointments = await prisma.appointment.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      convertedServiceOrder: { select: { id: true, workOrderNo: true } },
    },
    orderBy: { appointmentAt: "desc" },
  })

  return appointments.map((a) => ({
    ...a,
    appointmentNo: a.appointmentNo || formatAppointmentNo(a),
  }))
}

export async function getAppointmentCountsByStatus() {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [todayCount, upcoming, confirmed, arrived, noShow, cancelled] = await Promise.all([
    prisma.appointment.count({
      where: { workshopId, appointmentAt: { gte: today, lt: tomorrow }, status: { notIn: ["cancelled", "no_show", "completed"] } },
    }),
    prisma.appointment.count({
      where: { workshopId, appointmentAt: { gte: tomorrow }, status: { notIn: ["cancelled", "no_show", "completed"] } },
    }),
    prisma.appointment.count({ where: { workshopId, status: "confirmed" } }),
    prisma.appointment.count({ where: { workshopId, status: "arrived" } }),
    prisma.appointment.count({ where: { workshopId, status: "no_show" } }),
    prisma.appointment.count({ where: { workshopId, status: "cancelled" } }),
  ])

  return { today: todayCount, upcoming, confirmed, arrived, no_show: noShow, cancelled }
}

async function getFirstVehicle(workshopId: string, customerId: string): Promise<string | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { workshopId, customerId },
    select: { id: true },
  })
  return vehicle?.id || null
}
