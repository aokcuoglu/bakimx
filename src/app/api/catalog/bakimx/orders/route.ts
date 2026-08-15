import { NextResponse } from "next/server"
import { apiErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/db"
import { getVisibleBakimxProduct } from "@/lib/parts/bakimx-catalog"
import {
  bakimxCatalogWriteGuard,
  bakimxWriteGuardResponse,
} from "@/lib/parts/bakimx-catalog-guard"
import { bakimxOrderItemSnapshot } from "@/lib/catalog/bakimx-order"
import { bakimxOrderCreateSchema } from "@/lib/validations/bakimx-order"
import { getValidationError } from "@/lib/validations/shared"

/**
 * Atölyenin BakımX sipariş TALEBİ — `POST /api/catalog/bakimx/orders` (BAK-60).
 *
 * Neden server action değil de route: atölye yüzeyindeki BakımX kutuları zaten
 * `/api/catalog/bakimx/*` üzerinden konuşuyor (bkz. src/lib/parts/bakimx-client.ts)
 * ve "Sipariş ver" düğmesi parça seçicinin İÇİNDEKİ paylaşılan satır bileşeninde
 * duruyor. Aynı yolu kullanmak o bileşenin paketine sunucu modülü sokmadan
 * çalışmasını sağlıyor; kapı yine de action'larla aynı (`requireWritableWorkshop`
 * → plan kilidi + rol + geçici şifre), üstüne `bakimxCatalog` özellik kapısı.
 *
 * İKİ İNVARYANT BURADA DURUYOR:
 *
 *  1. **Fiyat istemciden gelmez.** Gövdede yalnız `bakimxProductId` + `quantity`
 *     var; şema fiyat alanı TANIMAZ. Kalemin tutarı `getVisibleBakimxProduct`'ın
 *     atölye kaydından çözdüğü iskontolu fiyattır (BAK-47).
 *  2. **Talep stoğa dokunmaz.** Burada hiçbir `bakimxProduct` yazması yok; stok
 *     yalnız admin siparişi `shipped` işaretlediğinde düşer
 *     (src/app/admin/catalog/orders/actions.ts).
 *
 * `workshopId` daima oturumdan gelir, gövdeden değil — atölye başkasının adına
 * sipariş açamaz.
 */
export async function POST(request: Request) {
  let guard: Awaited<ReturnType<typeof bakimxCatalogWriteGuard>>
  try {
    guard = await bakimxCatalogWriteGuard("parts.purchase")
  } catch (err) {
    return bakimxWriteGuardResponse(err)
  }
  if (guard instanceof NextResponse) return guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 })
  }

  const parsed = bakimxOrderCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: getValidationError(parsed) ?? "Geçersiz sipariş bilgisi." },
      { status: 400 },
    )
  }

  try {
    // Ürünler TEK TEK sunucudan okunur: pasifleşmiş / yayından kalkmış ürün
    // sipariş edilemesin ve fiyat kaydın kendisinden gelsin. Araç süzgeci yok —
    // sipariş bir araca değil atölyenin deposuna gider (`vehicleTypeId: null`
    // yalnız `universal` ürünleri açar, kapalı taraf).
    const snapshots = []
    for (const item of parsed.data.items) {
      const product = await getVisibleBakimxProduct(item.bakimxProductId, null, guard.workshopId)
      if (!product) {
        return NextResponse.json(
          { error: "BakımX ürünü bulunamadı veya yayından kaldırılmış." },
          { status: 404 },
        )
      }
      snapshots.push(bakimxOrderItemSnapshot(product, item.quantity))
    }

    const order = await prisma.bakimxOrder.create({
      data: {
        workshopId: guard.workshopId,
        createdByUserId: guard.userId,
        note: parsed.data.note || null,
        items: { create: snapshots },
      },
      select: { id: true, status: true, createdAt: true },
    })

    return NextResponse.json({ order }, { status: 201 })
  } catch (err) {
    console.error("[bakimx-catalog/orders]", err instanceof Error ? err.message : err)
    return apiErrorResponse(err)
  }
}
