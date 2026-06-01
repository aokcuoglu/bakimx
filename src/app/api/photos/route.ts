import { prisma } from "@/lib/db"
import { getStorageProvider } from "@/lib/storage"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const photoId = url.searchParams.get("id")
    const size = url.searchParams.get("size")

    if (!photoId) {
      return NextResponse.json({ error: "Fotoğraf ID gerekli" }, { status: 400 })
    }

    const photo = await prisma.vehiclePhoto.findFirst({
      where: { id: photoId, workshopId: user.workshopId },
    })

    if (!photo) {
      return NextResponse.json({ error: "Fotoğraf bulunamadı" }, { status: 404 })
    }

    if (!photo.storageKey) {
      return NextResponse.json({ error: "Fotoğraf dosyası mevcut değil" }, { status: 404 })
    }

    const provider = await getStorageProvider()
    const signedUrl = await provider.getSignedUrl(photo.storageKey, 3600)

    if (!signedUrl) {
      return NextResponse.json({ error: "Fotoğraf URL alınamadı" }, { status: 404 })
    }

    if (photo.storageProvider === "mock") {
      const response = await fetch(signedUrl)
      if (!response.ok) {
        return NextResponse.json({ error: "Fotoğraf alınamadı" }, { status: 500 })
      }
      const blob = await response.blob()
      const headers = new Headers()
      headers.set("Content-Type", photo.mimeType || "image/jpeg")
      headers.set("Cache-Control", "private, max-age=300")
      if (size === "thumb") {
        headers.set("X-Photo-Size", "thumb")
      }
      return new Response(blob, { headers })
    }

    return NextResponse.redirect(signedUrl)
  } catch {
    return NextResponse.json({ error: "Fotoğraf alınamadı" }, { status: 500 })
  }
}