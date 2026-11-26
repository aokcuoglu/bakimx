"use client"

import { ChevronRight, TriangleAlert } from "lucide-react"
import { DetailPanel, OrderStatusPill, detail } from "@/components/orders/order-detail-surface"
import { formatTRY } from "@/lib/format"
import type { OrderSectionId } from "@/lib/orders/detail-sections"
import type { OrderNextStep } from "@/lib/orders/next-step"
import { cn } from "@/lib/utils"

// İki satıra sığmayacak şikâyet "devamı" ile Özet'teki tam metne bağlanır.
// 390px telefonda kart içi satır ~40 karakter.
const COMPLAINT_PREVIEW_CHARS = 80

function NextStepLine({ step }: { step: OrderNextStep }) {
  return (
    <div className={detail.nextStep}>
      <p>
        Sıradaki adım: <span className="font-semibold">{step.label}</span>
      </p>
      {step.blocker && (
        <p className={detail.blocker}>
          <TriangleAlert aria-hidden />
          {step.blocker}
        </p>
      )}
      {step.note && <p className="text-[13px] leading-[18px] text-muted-foreground">{step.note}</p>}
    </div>
  )
}

/** Telefon özet kartının para satırı; Ödeme kartının kısa hâli (#912). */
export type OrderMobileMoney = {
  grandTotal: number
  /** Kasa açıksa kalan; değilse null (satır Genel Toplam'ı yazar). */
  remaining: number | null
  /** İndirim/KDV varken tek satırlık zincir (BAK-55); yoksa null. */
  chainText: string | null
}

/**
 * Telefon ve dar içerikte başlığın altındaki özet kartı (#911): müşteri ne
 * dedi, ne kadar alacak var, sıradaki adım ne. İki kolonda gizlenir; aynı
 * bilgiyi ray (Durum, Ödeme, Müşteri & Araç) gösterir.
 *
 * Para satırı düğme değil, Ödeme bölümüne bağlantıdır (#912): tahsilat düğmesi
 * hızlı işlemde ve Ödeme kartında durur, burada üçüncü kez tekrar etmez.
 */
export function OrderMobileSummary({
  complaint,
  money,
  nextStep,
  onNavigate,
}: {
  complaint: string
  /** Tutar girilmişse para satırı; değilse null (satır çizilmez). */
  money: OrderMobileMoney | null
  nextStep: OrderNextStep | null
  onNavigate: (id: OrderSectionId) => void
}) {
  const hasComplaint = complaint.trim().length > 0
  const truncated = complaint.length > COMPLAINT_PREVIEW_CHARS || complaint.includes("\n")
  return (
    <section aria-label="Kabul özeti" className={cn(detail.shell, detail.summary)}>
      <div className={detail.block}>
        <p className={detail.fieldLabel}>Müşteri şikayeti</p>
        {hasComplaint ? (
          <p className="line-clamp-2 whitespace-pre-line text-[15px] leading-5 text-foreground">{complaint}</p>
        ) : (
          <p className="text-[15px] leading-5 text-muted-foreground">Şikayet girilmedi</p>
        )}
        {hasComplaint && truncated && (
          <a
            href="#ozet"
            className={cn(detail.hit, "mt-1 inline-block text-sm text-primary hover:underline")}
            onClick={(event) => {
              event.preventDefault()
              onNavigate("ozet")
            }}
          >
            devamı
          </a>
        )}
      </div>
      {money && (
        <a
          href="#odeme"
          className={cn(detail.block, detail.summaryLink)}
          onClick={(event) => {
            event.preventDefault()
            onNavigate("odeme")
          }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-5 text-muted-foreground">
              {money.remaining != null ? "Kalan" : "Genel Toplam"}{" "}
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  money.remaining == null
                    ? "text-foreground"
                    : money.remaining > 0
                      ? "text-destructive-strong"
                      : "text-success-strong",
                )}
              >
                {formatTRY(money.remaining ?? money.grandTotal)}
              </span>
            </span>
            {money.remaining != null && (
              <span className="mt-0.5 block text-[13px] leading-[18px] text-muted-foreground tabular-nums">
                Genel Toplam {formatTRY(money.grandTotal)}
              </span>
            )}
            {money.chainText && (
              <span className="mt-0.5 block text-[13px] leading-[18px] text-muted-foreground tabular-nums">
                {money.chainText}
              </span>
            )}
          </span>
          <ChevronRight aria-hidden className={detail.summaryChevron} />
        </a>
      )}
      {nextStep && (
        <div className={detail.block}>
          <NextStepLine step={nextStep} />
        </div>
      )}
    </section>
  )
}

/**
 * Raydaki Durum kartı (#911, iki kolonda): durum hapı ve sıradaki adım.
 * Salt okunur — aksiyonlar başlıkta kalır. Hap panel başlığında (#912), kart
 * gövdesi yalnız sıradaki adımı taşır. Engellerin ayrıntısı ve çıkış yolu
 * şimdilik başlığın altındaki uyarılarda (#913'te bu karta taşınır).
 */
export function OrderStatusCard({ status, nextStep }: { status: string; nextStep: OrderNextStep | null }) {
  return (
    <DetailPanel title="Durum" aside={<OrderStatusPill status={status} />} className={detail.statusCard}>
      <div className={detail.block}>
        {nextStep ? (
          <NextStepLine step={nextStep} />
        ) : (
          <p className="text-[15px] leading-5 text-muted-foreground">
            {status === "cancelled" ? "Araç kabulü iptal edildi." : "Araç teslim edildi."}
          </p>
        )}
      </div>
    </DetailPanel>
  )
}
