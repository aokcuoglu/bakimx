import { prisma } from "@/lib/db"
import { getStorageProvider } from "@/lib/storage"
import { NextResponse } from "next/server"
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

    if (photo.storageProvider === "mock") {
      const response = await fetch(signedUrl)
      if (!response.ok) {
        notFound()
      }
      const blob = await response.blob()
      const headers = new Headers()
      headers.set("Content-Type", photo.mimeType || "image/jpeg")
      headers.set("Cache-Control", "public, max-age=300")
      return new Response(blob, { headers })
    }

    return NextResponse.redirect(signedUrl)
  } catch {
    notFound()
  }
}