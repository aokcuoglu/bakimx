"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { addTimelineEvent } from "@/lib/intake/timeline"
import { isOtpExpired } from "@/lib/intake/otp"
import { checkRateLimit, recordAttempt } from "@/lib/communications/rate-limit"
import { sendSMSDirect } from "@/lib/communications/sender"
import { updateOrderStatusAction } from "@/app/(app)/orders/actions"

const OTP_TTL_MS = 10 * 60 * 1000
const DELIVERY_TYPE = "vehicle_delivery"

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function isDemoSms(): boolean {
  return process.env.NODE_ENV !== "production" || (process.env.SMS_PROVIDER ?? "mock") === "mock"
}

export async function requestDeliveryOtpAction(intakeFormId: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
    include: { customer: true, vehicle: true },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (intake.status !== "ready_for_delivery") return { error: "Araç teslimata hazır değil" }

  const sendKey = `delivery-otp-send:${intakeFormId}`
  if (!checkRateLimit(sendKey).allowed) return { error: "Çok sık kod istendi, lütfen biraz sonra tekrar deneyin" }
  recordAttempt(sendKey)

  const otpCode = generateOtp()
  const customerName =
    intake.customer.type === "corporate"
      ? intake.customer.companyName || "Kurumsal Müşteri"
      : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"
  const approvalTextVersion = `Araç Teslim Onayı\n\nMüşteri: ${customerName}\nPlaka: ${intake.vehicle.plate}\n\nAracımı teslim aldım.`

  const approval = await prisma.approvalRequest.create({
    data: {
      workshopId: user.workshopId,
      intakeFormId,
      phone: intake.customer.phone,
      otpCode,
      approvalTextVersion,
      approvalType: DELIVERY_TYPE,
      status: "pending",
    },
  })

  // sendSMSDirect kendi hatasını yakalayıp {success:false} döndürür (throw etmez);
  // bu yüzden dönen .success'i kontrol et — sadece nadir throw için .catch.
  const smsResult = await sendSMSDirect(
    intake.customer.phone,
    `BakimX teslim onay kodunuz: ${otpCode}. Aracınızın teslimini onaylamak için bu kodu servise iletin.`,
  ).catch((e) => {
    console.error("[requestDeliveryOtp] SMS gönderilemedi:", e)
    return { success: false as const }
  })
  if (!smsResult.success && !isDemoSms()) {
    return { error: "Onay SMS'i gönderilemedi, lütfen tekrar deneyin" }
  }

  await AuditLogAction(user.workshopId, user.id, "ApprovalRequest", approval.id, "delivery_otp_requested")
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "delivery_otp_requested",
    description: "Teslim onay kodu gönderildi",
  })

  revalidatePath(`/intakes/${intakeFormId}`)
  return { success: true as const, otpCode: isDemoSms() ? otpCode : undefined }
}

export async function verifyDeliveryOtpAction(intakeFormId: string, code: string) {
  const user = await requireAuth()

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id: intakeFormId, workshopId: user.workshopId },
  })
  if (!intake) return { error: "Kabul formu bulunamadı" }
  if (intake.status !== "ready_for_delivery") return { error: "Araç teslimata hazır değil" }

  const verifyKey = `delivery-otp-verify:${intakeFormId}`
  if (!checkRateLimit(verifyKey).allowed) return { error: "Çok fazla deneme, lütfen biraz sonra tekrar deneyin" }
  recordAttempt(verifyKey)

  const approval = await prisma.approvalRequest.findFirst({
    where: { intakeFormId, workshopId: user.workshopId, approvalType: DELIVERY_TYPE, status: "pending" },
    orderBy: { createdAt: "desc" },
  })
  if (!approval) return { error: "Bekleyen teslim onayı bulunamadı, yeni kod isteyin" }

  if (isOtpExpired(approval.createdAt, new Date(), OTP_TTL_MS)) {
    await prisma.approvalRequest.updateMany({
      where: { id: approval.id, workshopId: user.workshopId },
      data: { status: "expired" },
    })
    return { error: "Kodun süresi doldu, lütfen yeni kod isteyin" }
  }

  if (approval.otpCode !== code) return { error: "Geçersiz doğrulama kodu" }

  await prisma.$transaction(async (tx) => {
    await tx.approvalRequest.updateMany({
      where: { id: approval.id, workshopId: user.workshopId },
      data: { status: "verified", approvedAt: new Date() },
    })
    await tx.vehicleIntakeForm.updateMany({
      where: { id: intakeFormId, workshopId: user.workshopId },
      data: { status: "delivered" },
    })
  })

  // Order'ı da delivered yap (yan etkiler: tamamlama/ödeme-hatırlatma). Order yoksa/uygun değilse sessiz geç.
  const order = await prisma.serviceOrder.findFirst({
    where: { intakeFormId, workshopId: user.workshopId },
  })
  if (order && order.status === "ready_for_delivery") {
    const orderResult = await updateOrderStatusAction(order.id, "delivered")
    if (orderResult && "error" in orderResult) {
      console.error("[verifyDeliveryOtp] Order teslim senkronu başarısız:", orderResult.error)
    }
  }

  await AuditLogAction(user.workshopId, user.id, "ApprovalRequest", approval.id, "delivery_otp_verified")
  await addTimelineEvent({
    workshopId: user.workshopId,
    intakeFormId,
    eventType: "delivered_otp_verified",
    description: "Müşteri OTP ile aracı teslim aldı",
  })

  revalidatePath(`/intakes/${intakeFormId}`)
  return { success: true as const }
}
