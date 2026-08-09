import { NextResponse } from "next/server"
import { APP_VERSION } from "@/lib/app-version"
import { getBuildSignature } from "@/lib/build-signature"

// Açık sekmelerin "sunucu hangi build'i çalıştırıyor" sorusunu sorduğu hafif uç.
// Bilerek bağımlılıksız (DB/ağ yok) ve oturum gerektirmez: middleware'de ne public
// ne de protected API prefix'inde olduğu için API dalı next() döner (bkz. middleware.ts,
// /api/health ile aynı davranış). Sürüm zaten landing footer'ında herkese görünür,
// yeni bir bilgi sızdırmaz; oturumsuz çalışması da çerezi bayatlamış bir sekmenin
// 401 yüzünden sessizce kör kalmasını engeller.
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION, signature: getBuildSignature() },
    {
      status: 200,
      // Ara katmanlarda (CloudFront/nginx/tarayıcı) cache'lenirse uç anlamını yitirir.
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  )
}
