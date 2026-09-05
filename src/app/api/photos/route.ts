import { prisma } from "@/lib/db"
import { getStorageProvider } from "@/lib/storage"
import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertFeature, hasWorkshopFeature } from "@/lib/plan"
import { apiErrorResponse } from "@/lib/api-errors"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"

export async function GET(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const url = new URL(request.url)
    const photoId = url.searchParams.get("id")
    const size = url.searchParams.get("size")
    const variant = url.searchParams.get("variant")
    if (variant === "annotated") assertFeature(workshop, "photoChecklist")
    const canReadAnnotations = hasWorkshopFeature(workshop, "photoChecklist")

    if (!photoId) {
      return NextResponse.json({ error: "Fotoğraf ID gerekli" }, { status: 400 })
    }

    const photo = await prisma.vehiclePhoto.findFirst({
      // Silinmiş kare artık servis edilmez (bayat <img src> ile de çekilemesin).
      where: { id: photoId, workshopId: user.workshopId, ...VISIBLE_PHOTO },
      include: { annotationVersions: { orderBy: { version: "desc" }, take: 1, select: { storageKey: true, mimeType: true } } },
    })

    if (!photo) {
      return NextResponse.json({ error: "Fotoğraf bulunamadı" }, { status: 404 })
    }

    const rendition = variant !== "original" && canReadAnnotations ? photo.annotationVersions[0] : undefined
    const storageKey = rendition?.storageKey ?? photo.storageKey
    if (!storageKey) {
      return NextResponse.json({ error: "Fotoğraf dosyası mevcut değil" }, { status: 404 })
    }

    const provider = await getStorageProvider()
    const signedUrl = await provider.getSignedUrl(storageKey, 3600)

    if (!signedUrl) {
      return NextResponse.json({ error: "Fotoğraf URL alınamadı" }, { status: 404 })
    }

    // Proxy the bytes through this same-origin, authenticated route instead of redirecting to
    // the storage backend. The gallery loads images via fetch()+blob(), which cannot read a
    // cross-origin S3 redirect without bucket CORS; proxying keeps everything same-origin and
    // works uniformly for the mock, MinIO and AWS S3 backends.
    const upstream = await fetch(signedUrl)
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Fotoğraf alınamadı" }, { status: 502 })
    }
    const headers = new Headers()
    headers.set("Content-Type", rendition?.mimeType || photo.mimeType || upstream.headers.get("content-type") || "image/jpeg")
    headers.set("Cache-Control", "private, no-store")
    if (size === "thumb") {
      headers.set("X-Photo-Size", "thumb")
    }
    return new Response(upstream.body, { headers })
  } catch (error) {
    return apiErrorResponse(error)
  }
}