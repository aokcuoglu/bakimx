import { prisma } from "@/lib/db"
import { getStorageProvider } from "@/lib/storage"
import { notFound } from "next/navigation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; photoId: string }> }
) {
  try {
    const { token, photoId } = await params

    const shareLink = await prisma.publicShareLink.findUnique({
      where: { token },
      select: {
        isActive: true,
        expiresAt: true,
        showPhotos: true,
        intakeForm: {
          select: {
            workshopId: true,
            photos: {
              where: { id: photoId },
              select: {
                workshopId: true,
                storageKey: true,
                storageProvider: true,
                mimeType: true,
              },
            },
          },
        },
      },
    })

    if (
      !shareLink ||
      !shareLink.isActive ||
      !shareLink.showPhotos ||
      (shareLink.expiresAt && shareLink.expiresAt < new Date())
    ) {
      notFound()
    }

    const photo = shareLink.intakeForm.photos[0]
    if (!photo || photo.workshopId !== shareLink.intakeForm.workshopId) {
      notFound()
    }

    if (!photo.storageKey) {
      notFound()
    }

    const provider = await getStorageProvider()
    const signedUrl = await provider.getSignedUrl(photo.storageKey, 3600)

    if (!signedUrl) {
      notFound()
    }

    // Proxy the bytes through this same-origin route instead of redirecting to the storage
    // backend, so a private S3 bucket (no CORS) works uniformly with the mock/MinIO backends.
    const upstream = await fetch(signedUrl)
    if (!upstream.ok || !upstream.body) {
      notFound()
    }
    const headers = new Headers()
    headers.set("Content-Type", photo.mimeType || upstream.headers.get("content-type") || "image/jpeg")
    headers.set("Cache-Control", "public, max-age=300")
    return new Response(upstream.body, { headers })
  } catch {
    notFound()
  }
}