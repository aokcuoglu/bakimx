import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { nanoid } from "nanoid"
import { prisma } from "@/lib/db"
import { requireFeatureWorkshop, requireWritableFeatureWorkshop } from "@/lib/auth"
import { apiErrorResponse } from "@/lib/api-errors"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { isIntakeWriteLocked } from "@/lib/status-transitions"
import { getStorageProvider, buildStoragePath, validateUploadFile } from "@/lib/storage"
import { photoAnnotationDocumentSchema } from "@/lib/image/photo-annotation"

const failure = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function GET(request: Request) {
  try {
    const { user } = await requireFeatureWorkshop("photoChecklist")
    const photoId = new URL(request.url).searchParams.get("photoId")
    if (!photoId) return failure("Fotoğraf seçin.", 400)
    const photo = await prisma.vehiclePhoto.findFirst({
      where: { id: photoId, workshopId: user.workshopId, serviceOrderItemId: null, ...VISIBLE_PHOTO },
      select: { annotationVersions: { orderBy: { version: "desc" }, take: 1, select: { version: true, document: true } } },
    })
    if (!photo) return failure("Fotoğraf bulunamadı.", 404)
    return NextResponse.json(photo.annotationVersions[0] ?? { version: 0, document: null }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return apiErrorResponse(error) }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireWritableFeatureWorkshop("order.edit", "photoChecklist")
    const form = await request.formData()
    const photoId = form.get("photoId")
    const requestId = form.get("requestId")
    const expected = form.get("expectedVersion")
    const rawDocument = form.get("document")
    const file = form.get("file")
    if (typeof photoId !== "string" || !photoId || typeof requestId !== "string" || !/^[\w-]{8,100}$/.test(requestId)
      || typeof expected !== "string" || !/^\d{1,9}$/.test(expected)
      || typeof rawDocument !== "string" || rawDocument.length > 1_000_000 || !(file instanceof File) || file.size === 0) {
      return failure("Çizim bilgileri geçersiz.", 400)
    }
    let input: unknown
    try { input = JSON.parse(rawDocument) } catch { return failure("Çizim verisi okunamadı.", 400) }
    const parsed = photoAnnotationDocumentSchema.safeParse(input)
    if (!parsed.success) return failure("Çizim koordinatları geçersiz.", 400)
    const validation = validateUploadFile(file)
    if (!validation.valid) return failure(validation.error || "Fotoğraf geçersiz.", 400)
    const photo = await prisma.vehiclePhoto.findFirst({
      where: { id: photoId, workshopId: user.workshopId, serviceOrderItemId: null, ...VISIBLE_PHOTO },
      include: { intakeForm: { select: { id: true, status: true, order: { select: { id: true, status: true } } } } },
    })
    if (!photo?.storageKey) return failure("Kaynak fotoğraf bulunamadı.", 404)
    if (isIntakeWriteLocked(photo.intakeForm.status, photo.intakeForm.order?.status)) return failure("Kapalı iş emrindeki fotoğraf düzenlenemez.", 409)
    const previous = await prisma.photoAnnotationVersion.findUnique({ where: { photoId_requestId: { photoId, requestId } }, select: { version: true } })
    if (previous) return NextResponse.json({ success: true, version: previous.version })

    // Every attempt has a unique storage path, including simultaneous retries.
    // Only the committed version becomes visible; the immutable source is never replaced.
    const provider = await getStorageProvider()
    const uploaded = await provider.upload(file, buildStoragePath(user.workshopId, photo.intakeFormId, "annotations", nanoid(), file.name))
    let retained = false
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (photo.intakeForm.order) await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${photo.intakeForm.order.id} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM "VehicleIntakeForm" WHERE id = ${photo.intakeFormId} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM "VehiclePhoto" WHERE id = ${photoId} FOR UPDATE`
        const current = await tx.vehiclePhoto.findFirst({
          where: { id: photoId, workshopId: user.workshopId, serviceOrderItemId: null, ...VISIBLE_PHOTO },
          include: { intakeForm: { select: { status: true, order: { select: { status: true } } } } },
        })
        if (!current || isIntakeWriteLocked(current.intakeForm.status, current.intakeForm.order?.status)) return { error: "Kayıt artık düzenlenemiyor.", status: 409 }
        const duplicate = await tx.photoAnnotationVersion.findUnique({ where: { photoId_requestId: { photoId, requestId } } })
        if (duplicate) return { version: duplicate.version, created: false }
        const latest = await tx.photoAnnotationVersion.findFirst({ where: { photoId }, orderBy: { version: "desc" }, select: { version: true } })
        if ((latest?.version ?? 0) !== Number(expected)) return { error: "Fotoğraf başka bir ekranda düzenlendi. Taslağınız korunuyor; güncel kaydı açın.", status: 409 }
        const version = (latest?.version ?? 0) + 1
        await tx.photoAnnotationVersion.create({ data: { photoId, version, requestId, document: parsed.data as Prisma.InputJsonValue, storageKey: uploaded.key, mimeType: file.type, createdById: user.id } })
        await tx.vehiclePhoto.update({ where: { id: photoId }, data: { updatedAt: new Date() } })
        await tx.auditLog.create({ data: { workshopId: user.workshopId, actorUserId: user.id, entityType: "VehiclePhoto", entityId: photoId, action: "photo_annotated", orderId: photo.intakeForm.order?.id, metadataJson: JSON.stringify({ version }) } })
        return { version, created: true }
      })
      if ("error" in result) return failure(result.error!, result.status!)
      retained = result.created
      return NextResponse.json({ success: true, version: result.version })
    } finally {
      if (!retained) await provider.delete(uploaded.key).catch(() => undefined)
    }
  } catch (error) { return apiErrorResponse(error) }
}
