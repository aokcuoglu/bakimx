import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-errors"

/**
 * İş emri detay sayfasının hafif "senkron sürümü" ucu.
 *
 * `useOrderSync` bunu periyodik olarak çağırır ve dönen token değiştiğinde
 * `router.refresh()` tetikler. Amaç: idle sekmede her 5 sn'de tüm RSC ağacını
 * (ve içindeki onlarca Prisma sorgusu + render) yeniden çekmek yerine, önce
 * ucuz bir aggregate ile "bir şey değişti mi?" diye bakmak.
 *
 * Token, sayfada gösterilen değişebilir verilerin `max(updatedAt/createdAt)` +
 * `count` bileşimidir; count sayesinde silme işlemleri de yakalanır. Satır
 * hidrasyonu / RSC render yoktur, sorgular indekslidir → tam sayfaya kıyasla
 * çok ucuzdur.
 *
 * Tenant izolasyonu: her sorgu `workshopId`'ye (requireAuth'tan) göre kısıtlanır.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const order = await prisma.serviceOrder.findFirst({
      where: { id, workshopId: user.workshopId },
      select: { id: true, intakeFormId: true, updatedAt: true },
    })
    if (!order) {
      return NextResponse.json({ error: "Bulunamadı" }, { status: 404 })
    }

    const workshopId = user.workshopId
    const intakeScope = { workshopId, intakeFormId: order.intakeFormId }

    const [intake, items, collections, photos, damageMarks, timeline, approvals, activity] =
      await Promise.all([
        prisma.vehicleIntakeForm.findFirst({
          where: { id: order.intakeFormId, workshopId },
          select: { updatedAt: true },
        }),
        prisma.serviceOrderItem.aggregate({
          where: { workshopId, serviceOrderId: order.id },
          _max: { updatedAt: true },
          _count: true,
        }),
        prisma.collectionPayment.aggregate({
          where: { workshopId, serviceOrderId: order.id },
          _max: { updatedAt: true },
          _count: true,
        }),
        prisma.vehiclePhoto.aggregate({
          where: intakeScope,
          _max: { updatedAt: true },
          _count: true,
        }),
        prisma.damageMark.aggregate({
          where: intakeScope,
          _max: { createdAt: true },
          _count: true,
        }),
        prisma.intakeTimelineEvent.aggregate({
          where: intakeScope,
          _max: { createdAt: true },
          _count: true,
        }),
        prisma.approvalRequest.aggregate({
          where: intakeScope,
          _max: { updatedAt: true },
          _count: true,
        }),
        prisma.auditLog.aggregate({
          where: { workshopId, orderId: order.id },
          _max: { createdAt: true },
          _count: true,
        }),
      ])

    const ms = (d: Date | null | undefined) => (d ? d.getTime() : 0)

    const version = [
      ms(order.updatedAt),
      ms(intake?.updatedAt),
      `${items._count}:${ms(items._max.updatedAt)}`,
      `${collections._count}:${ms(collections._max.updatedAt)}`,
      `${photos._count}:${ms(photos._max.updatedAt)}`,
      `${damageMarks._count}:${ms(damageMarks._max.createdAt)}`,
      `${timeline._count}:${ms(timeline._max.createdAt)}`,
      `${approvals._count}:${ms(approvals._max.updatedAt)}`,
      `${activity._count}:${ms(activity._max.createdAt)}`,
    ].join("|")

    return NextResponse.json(
      { version },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    return apiErrorResponse(err)
  }
}
