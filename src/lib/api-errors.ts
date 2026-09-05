import { NextResponse } from "next/server"
import { PermissionError } from "@/lib/rbac"
import { PlanFeatureLockedError } from "@/lib/plan"

/**
 * API route'larının ortak hata çevirisi (#183).
 *
 * Yetki reddi 500 "Bir hata oluştu" olarak dönerse iki şey birden bozulur:
 * kullanıcı neden reddedildiğini öğrenemez, ve log'da gerçek hatalarla
 * yetki redleri birbirine karışır. Kapı hatası 403 + kendi mesajıyla döner;
 * geri kalan her şey eskisi gibi jenerik 500 kalır (iç detay sızmasın).
 */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof PermissionError) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }
  if (err instanceof PlanFeatureLockedError) {
    return NextResponse.json(
      { error: err.message, code: err.code, feature: err.feature },
      { status: 403 }
    )
  }
  return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
}
