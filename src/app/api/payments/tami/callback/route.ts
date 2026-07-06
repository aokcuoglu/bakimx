import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getTamiClient } from "@/lib/tami"
import { getTamiConfig, isTamiConfigured } from "@/lib/tami/config"
import { verifyCallbackHash } from "@/lib/tami/hash"
import { TamiError, TAMI_ERROR_MESSAGES, sanitizeForLog } from "@/lib/tami/errors"
import { MOCK_SECRET_KEY } from "@/lib/tami/mock"
import type { TamiCallbackHashFields } from "@/lib/tami/types"
import { activateBillingOrder } from "@/lib/billing/activate"
import { minorToTamiAmountString } from "@/lib/billing/payment-helpers"
import { founderAlertEmail } from "@/lib/emails/system-emails"
import { sendEmailDirect } from "@/lib/communications/sender"
import { getAdminEmails } from "@/lib/admin"

/**
 * TAMI 3DS callback (public, oturumsuz). Banka (veya mock form) 3DS doğrulaması
 * sonrası form-urlencoded POST atar. Güvenlik değişmezleri:
 *  - hashedData RAW wire string'ler üzerinden verifyCallbackHash ile doğrulanır
 *    (herhangi bir durum değişikliğinden ÖNCE).
 *  - Aktivasyon idempotent claim'in ARDINDAN çalışır; tekrar gelen callback
 *    (replay) yan etkisizdir.
 *  - Ödeme sonucu YALNIZ DB'ye yazılır; sonuç sayfası query'den değil DB'den okur.
 *  - Kart verisi callback'te gelmez (yalnız maskedNumber); yine de callbackPayload
 *    sanitizeForLog'tan geçer.
 */

const NOW = () => new Date()

function callbackSecret(): string {
  return isTamiConfigured() ? getTamiConfig().secretKey : MOCK_SECRET_KEY
}

function resultRedirect(request: Request, ref: string | null): Response {
  const origin = process.env.APP_URL || new URL(request.url).origin
  const url = new URL("/payment/result", origin)
  if (ref) url.searchParams.set("ref", ref)
  return NextResponse.redirect(url, 303)
}

/** Founder ops uyarısı — para çekildi ama aktivasyon başarısız gibi kritik durumlar için. */
async function alertFounders(title: string, detail: string): Promise<void> {
  try {
    const to = getAdminEmails()
    if (to.length === 0) return
    const built = founderAlertEmail({ title, detail })
    await sendEmailDirect(to.join(","), built.subject, built.html)
  } catch (err) {
    console.error("[payments/callback] founder alert failed:", err instanceof Error ? err.message : err)
  }
}

export async function POST(request: Request) {
  // 1) Gövdeyi RAW string map'e parse et (tüm değerler string kalsın).
  let raw: Record<string, string>
  try {
    const form = await request.formData()
    raw = {}
    for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v : ""
  } catch {
    return resultRedirect(request, null)
  }

  const providerOrderId = raw.orderId || ""

  // 2) hashedData doğrulaması — RAW string alanlarla, durum değişmeden ÖNCE.
  const hashFields: TamiCallbackHashFields & { hashedData: string } = {
    cardOrganization: raw.cardOrganization ?? "",
    cardBrand: raw.cardBrand ?? "",
    cardType: raw.cardType ?? "",
    maskedNumber: raw.maskedNumber ?? "",
    installmentCount: raw.installmentCount ?? "",
    currencyCode: raw.currencyCode ?? "",
    txnAmount: raw.txnAmount ?? "",
    orderId: raw.orderId ?? "",
    systemTime: raw.systemTime ?? "",
    success: raw.success ?? "",
    hashedData: raw.hashedData ?? "",
  }
  if (!verifyCallbackHash(hashFields, { secretKey: callbackSecret() })) {
    // Her istekte founder alert GÖNDERME — yalnız logla (debounce'lı alert Task 9).
    console.warn("[payments/callback] hash doğrulaması başarısız:", sanitizeForLog({ providerOrderId }))
    return new Response("invalid signature", { status: 400 })
  }

  const now = NOW()
  const sanitizedPayload = sanitizeForLog(raw) as Record<string, string>

  // 3) İdempotent claim — TEK YÖNLÜ geçiş: yalnız `initiated` durumundaki txn
  // sahiplenilir (hedef durum match set'inde DEĞİL). Böylece eşzamanlı/tekrar
  // gelen callback'lerin (banka retry / çift POST) yalnız BİRİ kazanır; kaybeden
  // count===0 alır ve complete3ds'e ASLA gitmez (çifte çekim yok, sahte founder
  // alert yok). callback_received'da takılı kalan satırlar tekrar teslim edilen
  // callback'lerle DEĞİL, cron mutabakatı + admin retry ile kurtarılır (ileriki görev).
  const claim = await prisma.paymentTransaction.updateMany({
    where: { providerOrderId, status: "initiated" },
    data: {
      status: "callback_received",
      callbackPayload: sanitizedPayload,
      maskedPan: raw.maskedNumber || null,
      cardBrand: raw.cardBrand || null,
    },
  })

  // Order referansını (redirect için) txn üzerinden çöz — claim edilmemiş olsa da.
  const txn = await prisma.paymentTransaction.findUnique({
    where: { providerOrderId },
    include: { billingOrder: { select: { id: true, reference: true } } },
  })
  const ref = txn?.billingOrder.reference ?? null

  // count===0 → zaten işlenmiş ya da bilinmeyen orderId → yan etkisiz, result'a dön.
  if (claim.count === 0 || !txn) {
    return resultRedirect(request, ref)
  }

  const orderId = txn.billingOrder.id
  const mdStatus = raw.mdStatus ?? ""
  const successTruthy = raw.success === "true" || raw.success === "1"

  // 4) Başarı yolu: mdStatus=1 + success → tutar/para birimi doğrulaması →
  // complete3ds → aktivasyon.
  if (mdStatus === "1" && successTruthy) {
    // Tutar/para birimi, çekimden ÖNCE txn snapshot'ına karşı doğrulanır.
    // txnAmount wire formatı: tam 2 ondalıklı string ("7499.00") — mock
    // `input.amount.toFixed(2)` gönderir, karşılaştırma bu EXACT formata karşı.
    // currencyCode: mock alfabetik "TRY" gönderir → txn.currency ile birebir;
    // gerçek TAMI wire ISO 4217 sayısal kod kullanırsa diye TRY için "949" da
    // kabul edilir (sandbox'ta canlı teyit edilmedi — raporda not).
    const expectedAmount = minorToTamiAmountString(txn.amountMinor)
    const currencyOk =
      raw.currencyCode === txn.currency || (txn.currency === "TRY" && raw.currencyCode === "949")
    if (raw.txnAmount !== expectedAmount || !currencyOk) {
      console.warn(
        "[payments/callback] tutar/para birimi uyuşmazlığı:",
        sanitizeForLog({ providerOrderId, txnAmount: raw.txnAmount, currencyCode: raw.currencyCode, expectedAmount, expectedCurrency: txn.currency })
      )
      await prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: {
          status: "failed",
          errorCode: "amount_mismatch",
          errorMessage: TAMI_ERROR_MESSAGES.default,
        },
      })
      return resultRedirect(request, ref)
    }

    try {
      const completed = await getTamiClient().complete3ds(providerOrderId)
      if (!completed.success) {
        await prisma.paymentTransaction.update({
          where: { id: txn.id },
          data: {
            status: "failed",
            errorCode: completed.errorCode || "COMPLETE_FAILED",
            errorMessage: completed.errorMessage || TAMI_ERROR_MESSAGES.default,
          },
        })
        return resultRedirect(request, ref)
      }

      // Para çekildi. ÖNCE aktivasyon; başarısızsa txn'i completed YAPMA.
      const activation = await activateBillingOrder(orderId, { actor: "payment", confirmedByEmail: "tami" })
      if (!activation.ok) {
        console.error("[payments/callback] activation failed after capture:", sanitizeForLog({ providerOrderId, error: activation.error }))
        await alertFounders(
          "Ödeme çekildi, aktivasyon başarısız",
          `Sipariş ${ref ?? orderId} için TAMI ödemesi başarıyla çekildi ancak plan aktivasyonu başarısız oldu: ${activation.error}. Manuel kontrol gerekli (işlem: ${providerOrderId}).`
        )
        // txn callback_received'da kalır (completed değil) — el ile telafi edilecek.
        return resultRedirect(request, ref)
      }

      await prisma.paymentTransaction.update({
        where: { id: txn.id },
        data: { status: "completed", completedAt: now },
      })
      return resultRedirect(request, ref)
    } catch (err) {
      const code = err instanceof TamiError ? err.code : "COMPLETE_ERROR"
      const message = err instanceof TamiError ? err.message : "3DS tamamlama hatası"
      console.error("[payments/callback] complete3ds failed:", sanitizeForLog({ providerOrderId, code, message }))
      await prisma.paymentTransaction
        .update({ where: { id: txn.id }, data: { status: "failed", errorCode: code, errorMessage: message } })
        .catch(() => {})
      return resultRedirect(request, ref)
    }
  }

  // 5) mdStatus != 1 → başarısız 3DS.
  await prisma.paymentTransaction.update({
    where: { id: txn.id },
    data: {
      status: "failed",
      errorCode: raw.errorCode || mdStatus || "3DS_FAILED",
      errorMessage: TAMI_ERROR_MESSAGES[raw.errorCode ?? ""] ?? TAMI_ERROR_MESSAGES.default,
    },
  })

  // 6) Her durumda 303 → result (ref DB'den; query'ye sonuç konmaz).
  return resultRedirect(request, ref)
}
