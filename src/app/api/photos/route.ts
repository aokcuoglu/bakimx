import { prisma } from "@/lib/db"
import { getStorageProvider } from "@/lib/storage"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"

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
      // Silinmiş kare artık servis edilmez (bayat <img src> ile de çekilemesin).
      where: { id: photoId, workshopId: user.workshopId, ...VISIBLE_PHOTO },
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

    // Proxy the bytes through this same-origin, authenticated route instead of redirecting to
    // the storage backend. The gallery loads images via fetch()+blob(), which cannot read a
    // cross-origin S3 redirect without bucket CORS; proxying keeps everything same-origin and
    // works uniformly for the mock, MinIO and AWS S3 backends.
    const upstream = await fetch(signedUrl)
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Fotoğraf alınamadı" }, { status: 502 })
    }
    const headers = new Headers()
    headers.set("Content-Type", photo.mimeType || upstream.headers.get("content-type") || "image/jpeg")
    headers.set("Cache-Control", "private, max-age=300")
    if (size === "thumb") {
      headers.set("X-Photo-Size", "thumb")
    }
    return new Response(upstream.body, { headers })
  } catch {
    return NextResponse.json({ error: "Fotoğraf alınamadı" }, { status: 500 })
  }
}