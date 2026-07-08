import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getTamiClient } from "@/lib/tami"
import { getTamiConfig, isTamiConfigured } from "@/lib/tami/config"
import { verifyCallbackHash } from "@/lib/tami/hash"
import { TamiError, TAMI_ERROR_MESSAGES, sanitizeForLog } from "@/lib/tami/errors"
import { MOCK_SECRET_KEY } from "@/lib/tami/mock"
import type { TamiCallbackHashFields } from "@/lib/tami/types"
import { activateBillingOrder } from "@/lib/billing/activate"
import { activateVerifiedWorkshop, alertVerifyCancelFailureOnce } from "@/lib/billing/verify-activation"
import { createVerifyToken } from "@/lib/billing/verify-token"
import { tamiAmountEqualsMinor, resolveClientIp } from "@/lib/billing/payment-helpers"
import { founderAlertEmail, paymentReceiptEmail } from "@/lib/emails/system-emails"
import { sendEmailDirect } from "@/lib/communications/sender"
import { sendSystemEmail } from "@/lib/emails/send-system-email"
import { getAdminEmails } from "@/lib/admin"
import { getPlanPackage } from "@/lib/plans-catalog"
import { alertHashFailureOnce } from "@/lib/tami/hash-fail-alert"
import { isCardPaymentBlocked } from "@/lib/tami/misconfig-alert"

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

/** Kart doğrulama sonucu — vref token yalnız workshop'u tanıtır (sonuç DB'den okunur). */
function verifyResultRedirect(request: Request, vtoken: string): Response {
  const origin = process.env.APP_URL || new URL(request.url).origin
  const url = new URL("/payment/result", origin)
  url.searchParams.set("vref", vtoken)
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

/** Başarılı kart ödemesi sonrası makbuz e-postası — best-effort, akışı BOZMAZ
 *  (hata durumunda yalnız loglanır; 303 redirect her koşulda çalışır). */
async function sendReceiptEmail(orderId: string, maskedPan: string | null, reference: string | null): Promise<void> {
  try {
    const order = await prisma.billingOrder.findUnique({
      where: { id: orderId },
      select: {
        planTier: true,
        billingCycle: true,
        amountMinor: true,
        periodEnd: true,
        workshopId: true,
        workshop: { select: { name: true, email: true } },
      },
    })
    if (!order || !order.periodEnd) return

    const owner = await prisma.user.findFirst({
      where: { workshopId: order.workshopId, role: "owner" },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    })
    const to = owner?.email || order.workshop.email
    if (!to) return

    const built = paymentReceiptEmail({
      workshopName: order.workshop.name,
      planLabel: getPlanPackage(order.planTier)?.name ?? order.planTier,
      cycleLabel: order.billingCycle === "monthly" ? "Aylık" : "Yıllık",
      amountMinor: order.amountMinor,
      maskedPan,
      periodEnd: order.periodEnd,
      reference: reference ?? orderId,
    })

    await sendSystemEmail({
      to,
      subject: built.subject,
      html: built.html,
      workshopId: order.workshopId,
      templateKey: `payment_receipt:${reference ?? orderId}`,
    })
  } catch (err) {
    console.error("[payments/callback] receipt email failed:", err instanceof Error ? err.message : err)
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

  // 1b) Prod build'de (NODE_ENV) TAMI yapılandırması eksikse callback'i mock
  // secret ile DOĞRULAMADAN reddet. Aksi halde public mock secret ile imzalanmış
  // sahte bir callback prod'da bir siparişi bedava aktive edebilirdi (initiate
  // tarafı da aynı guard ile kapalı). TAMI_ENV'e GÜVENİLMEZ — prod .env'e TAMI
  // bloğu hiç girmediyse TAMI_ENV de unset olur ve "sandbox"a düşerdi (bkz.
  // isCardPaymentBlocked). Hiçbir durum değiştirilmez; 503 döner.
  if (isCardPaymentBlocked({ nodeEnv: process.env.NODE_ENV, tamiConfigured: isTamiConfigured() })) {
    console.error("[payments/callback] TAMI prod yapılandırması eksik — callback reddedildi:", sanitizeForLog({ providerOrderId }))
    return new Response("payment provider not configured", { status: 503 })
  }

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
    // Mevcut davranış AYNEN kalır: logla + 400. Ek olarak saatte en fazla 1
    // founder alert (dedup — bkz. hash-fail-alert.ts); best-effort, akışı bozmaz.
    console.warn("[payments/callback] hash doğrulaması başarısız:", sanitizeForLog({ providerOrderId }))
    const ip = resolveClientIp(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip"))
    await alertHashFailureOnce({ providerOrderId, ip }).catch((err) => {
      console.error("[payments/callback] hash-fail alert error:", err instanceof Error ? err.message : err)
    })
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
  const ref = txn?.billingOrder?.reference ?? null

  // count===0 → zaten işlenmiş ya da bilinmeyen orderId → yan etkisiz, result'a dön.
  if (claim.count === 0 || !txn) {
    return resultRedirect(request, ref)
  }

  const mdStatus = raw.mdStatus ?? ""
  const successTruthy = raw.success === "true" || raw.success === "1"

  // purpose dallanması — claim (tek-yönlü) ve hash doğrulaması SONRASI. Kart doğrulama
  // denemelerinin siparişi yoktur (billingOrder null); ayrı bir yol izler.
  if (txn.purpose === "card_verification") {
    return handleCardVerificationCallback(request, txn, raw, now, mdStatus, successTruthy)
  }

  // Buradan sonrası purpose=purchase. purchase txn'inde billingOrder BEKLENİR;
  // yoksa (veri tutarsızlığı) sessizce yutma — sanitize logla ve no-op result'a dön.
  if (!txn.billingOrder) {
    console.warn(
      "[payments/callback] purchase txn'inde billingOrder yok — atlanıyor:",
      sanitizeForLog({ providerOrderId })
    )
    return resultRedirect(request, ref)
  }

  const orderId = txn.billingOrder.id

  // 4) Başarı yolu: mdStatus=1 + success → tutar/para birimi doğrulaması →
  // complete3ds → aktivasyon.
  if (mdStatus === "1" && successTruthy) {
    // Tutar/para birimi, çekimden ÖNCE txn snapshot'ına karşı doğrulanır.
    // txnAmount wire formatı canlı sandbox'ta SAYISAL biçimli string'dir ("1", "1299.5" —
    // tam 2 ondalıklı DEĞİL); karşılaştırma bu yüzden EXACT string yerine sayısal eşitlik
    // (tamiAmountEqualsMinor) ile yapılır (bkz. callback-capture.json).
    // currencyCode: mock alfabetik "TRY" gönderir → txn.currency ile birebir;
    // gerçek TAMI wire ISO 4217 sayısal kod kullanırsa diye TRY için "949" da
    // kabul edilir (sandbox'ta canlı teyit edilmedi — raporda not).
    const currencyOk =
      raw.currencyCode === txn.currency || (txn.currency === "TRY" && raw.currencyCode === "949")
    if (!tamiAmountEqualsMinor(raw.txnAmount ?? "", txn.amountMinor) || !currencyOk) {
      console.warn(
        "[payments/callback] tutar/para birimi uyuşmazlığı:",
        sanitizeForLog({ providerOrderId, txnAmount: raw.txnAmount, currencyCode: raw.currencyCode, expectedAmountMinor: txn.amountMinor, expectedCurrency: txn.currency })
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
      await sendReceiptEmail(orderId, raw.maskedNumber || null, ref)
      return resultRedirect(request, ref)
    } catch (err) {
      const code = err instanceof TamiError ? err.code : "COMPLETE_ERROR"
      const message = err instanceof TamiError ? err.message : "3DS tamamlama hatası"
      console.error("[payments/callback] complete3ds failed:", sanitizeForLog({ providerOrderId, code, message }))
      await prisma.paymentTransaction
        .update({ where: { id: txn.id }, data: { status: "failed", errorCode: code, errorMessage: message } })
        .catch((e) =>
          console.error(
            "[payments/callback] txn 'failed' durumuna yazılamadı (yutulmuş hata):",
            sanitizeForLog({ providerOrderId, error: e instanceof Error ? e.message : String(e) })
          )
        )
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

/**
 * purpose=card_verification callback dalı. Satış dalıyla SİMETRİK: tutar/para birimi
 * doğrulaması (SABİT 100 kuruş) → complete3ds → BAŞARIDA (a) 1 TL bloke iptali
 * (best-effort; hata akışı BOZMAZ, dedup'lu founder alert) (b) activateVerifiedWorkshop
 * (claim-guard'lı, idempotent) (c) txn completed. Her durumda 303 → result?vref=<token>.
 * Sonuç yalnız DB'ye yazılır; vref token yalnızca workshop'u tanıtır.
 */
async function handleCardVerificationCallback(
  request: Request,
  txn: { id: string; providerOrderId: string; workshopId: string; amountMinor: number; currency: string },
  raw: Record<string, string>,
  now: Date,
  mdStatus: string,
  successTruthy: boolean
): Promise<Response> {
  const providerOrderId = txn.providerOrderId
  const vtoken = createVerifyToken(txn.workshopId)

  // Başarısız 3DS (mdStatus != 1) → failed.
  if (mdStatus !== "1" || !successTruthy) {
    await prisma.paymentTransaction.update({
      where: { id: txn.id },
      data: {
        status: "failed",
        errorCode: raw.errorCode || mdStatus || "3DS_FAILED",
        errorMessage: TAMI_ERROR_MESSAGES[raw.errorCode ?? ""] ?? TAMI_ERROR_MESSAGES.default,
      },
    })
    return verifyResultRedirect(request, vtoken)
  }

  // Tutar/para birimi, çekimden ÖNCE txn snapshot'ına (SABİT 100 kuruş) karşı doğrulanır.
  const currencyOk =
    raw.currencyCode === txn.currency || (txn.currency === "TRY" && raw.currencyCode === "949")
  if (!tamiAmountEqualsMinor(raw.txnAmount ?? "", txn.amountMinor) || !currencyOk) {
    console.warn(
      "[payments/callback] doğrulama tutar/para birimi uyuşmazlığı:",
      sanitizeForLog({ providerOrderId, txnAmount: raw.txnAmount, currencyCode: raw.currencyCode, expectedAmountMinor: txn.amountMinor })
    )
    await prisma.paymentTransaction.update({
      where: { id: txn.id },
      data: { status: "failed", errorCode: "amount_mismatch", errorMessage: TAMI_ERROR_MESSAGES.default },
    })
    return verifyResultRedirect(request, vtoken)
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
      return verifyResultRedirect(request, vtoken)
    }

    // (a) 1 TL bloke iptali — BEST-EFFORT. Başarısızlık AKIŞI BOZMAZ: dedup'lu founder
    //     alert + txn.errorMessage'a bilgi notu; provizyon 7-9 günde kendiliğinden düşer.
    let cancelNote: string | null = null
    try {
      const cancelled = await getTamiClient().cancel({
        orderId: providerOrderId,
        reason: "card verification pre-auth release",
      })
      if (!cancelled.success) {
        throw new TamiError({
          code: cancelled.errorCode || "CANCEL_FAILED",
          message: cancelled.errorMessage || "provizyon iptali başarısız",
        })
      }
    } catch (cancelErr) {
      cancelNote = "1 TL doğrulama provizyonu iptali başarısız — 7-9 günde kendiliğinden düşer."
      console.warn(
        "[payments/callback] doğrulama provizyon iptali başarısız:",
        sanitizeForLog({ providerOrderId, error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr) })
      )
      await alertVerifyCancelFailureOnce({ providerOrderId, workshopId: txn.workshopId }).catch((err) => {
        console.error("[payments/callback] verify cancel alert error:", err instanceof Error ? err.message : err)
      })
    }

    // (b) Aktivasyon — claim-guard'lı + idempotent. Başarısızsa txn'i completed YAPMA
    //     (satış dalıyla aynı bar: founder alert + callback_received'da bırak → retry telafi).
    const activation = await activateVerifiedWorkshop(txn.workshopId)
    if (!activation.ok) {
      console.error("[payments/callback] doğrulama aktivasyonu başarısız:", sanitizeForLog({ providerOrderId }))
      await alertFounders(
        "Kart doğrulandı, aktivasyon başarısız",
        `Workshop ${txn.workshopId} için 1 TL kart doğrulaması başarılı ancak deneme aktivasyonu başarısız oldu. Manuel kontrol gerekli (işlem: ${providerOrderId}).`
      )
      return verifyResultRedirect(request, vtoken)
    }

    // (c) Completed. cancelNote yalnız BİLGİ notudur (hata değil) — akış başarıyla bitti.
    await prisma.paymentTransaction.update({
      where: { id: txn.id },
      data: { status: "completed", completedAt: now, errorMessage: cancelNote },
    })
    return verifyResultRedirect(request, vtoken)
  } catch (err) {
    const code = err instanceof TamiError ? err.code : "COMPLETE_ERROR"
    const message = err instanceof TamiError ? err.message : "3DS tamamlama hatası"
    console.error("[payments/callback] doğrulama complete3ds failed:", sanitizeForLog({ providerOrderId, code, message }))
    await prisma.paymentTransaction
      .update({ where: { id: txn.id }, data: { status: "failed", errorCode: code, errorMessage: message } })
      .catch((e) =>
        console.error(
          "[payments/callback] txn 'failed' durumuna yazılamadı (yutulmuş hata):",
          sanitizeForLog({ providerOrderId, error: e instanceof Error ? e.message : String(e) })
        )
      )
    return verifyResultRedirect(request, vtoken)
  }
}
