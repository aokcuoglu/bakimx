"use client"

import { ChevronRight, TriangleAlert } from "lucide-react"
import { DetailPanel, OrderStatusPill, detail } from "@/components/orders/order-detail-surface"
import { formatTRY } from "@/lib/format"
import { formatTrDateTime } from "@/lib/format-date"
import type { OrderSectionId } from "@/lib/orders/detail-sections"
import type { OrderNextStep, OrderStepIssue } from "@/lib/orders/next-step"
import { cn } from "@/lib/utils"

// İki satıra sığmayacak şikâyet "devamı" ile Özet'teki tam metne bağlanır.
// 390px telefonda kart içi satır ~40 karakter.
const COMPLAINT_PREVIEW_CHARS = 80

/** Engel ya da not: ne eksik, hangileri, ne yapılmalı ve Kalemler'e bağlantı (#913). */
function StepIssue({
  issue,
  blocker,
  onNavigate,
}: {
  issue: OrderStepIssue
  blocker: boolean
  onNavigate: (id: OrderSectionId) => void
}) {
  return (
    <div className={detail.stepIssue}>
      {blocker && <TriangleAlert aria-hidden className={detail.stepIssueIcon} />}
      <div className="min-w-0">
        <p className={blocker ? detail.stepIssueTitle : undefined}>{issue.text}</p>
        {issue.preview && <p className="truncate text-foreground">{issue.preview}</p>}
        <p>{issue.hint}</p>
        <a
          href="#kalemler"
          className={cn(detail.hit, "mt-0.5 inline-block font-medium text-primary hover:underline")}
          onClick={(event) => {
            event.preventDefault()
            onNavigate("kalemler")
          }}
        >
          {issue.linkLabel}
        </a>
      </div>
    </div>
  )
}

function NextStepLine({ step, onNavigate }: { step: OrderNextStep; onNavigate: (id: OrderSectionId) => void }) {
  return (
    <div className={detail.nextStep}>
      <p>
        Sıradaki adım: <span className="font-semibold">{step.label}</span>
      </p>
      {step.blockers.map((issue) => (
        <StepIssue key={issue.kind} issue={issue} blocker onNavigate={onNavigate} />
      ))}
      {step.notes.map((issue) => (
        <StepIssue key={issue.kind} issue={issue} blocker={false} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

/**
 * Kapanmış kabulün durumu (#913): ne zaman teslim edildi / iptal edildi ve —
 * yetki varsa — geri gelen aracın kabulünün nereden yeniden açılacağı. "Yeniden
 * Aç" başlığın ⋯ menüsünde; burada yalnız yol tarif edilir.
 */
function ClosedLine({ status, closedAt, canReopen }: { status: string; closedAt?: string; canReopen: boolean }) {
  const what = status === "cancelled" ? "Araç kabulü iptal edildi" : "Araç teslim edildi"
  return (
    <div className={detail.nextStep}>
      <p>{closedAt ? `${what} · ${formatTrDateTime(closedAt)}` : `${what}.`}</p>
      {canReopen && status === "delivered" && (
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Araç geri geldiyse başlıktaki ⋯ menüsünden yeniden açabilirsiniz. Tahsilat ve müşteri onayı
          kayıtları korunur.
        </p>
      )}
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
  status,
  closedAt,
  canReopen = false,
  onNavigate,
}: {
  complaint: string
  /** Tutar girilmişse para satırı; değilse null (satır çizilmez). */
  money: OrderMobileMoney | null
  nextStep: OrderNextStep | null
  status: string
  /** Kapanmış kabulde kapanış anı (ISO); bilinmiyorsa tarih yazılmaz. */
  closedAt?: string
  canReopen?: boolean
  onNavigate: (id: OrderSectionId) => void
}) {
  const hasComplaint = complaint.trim().length > 0
  const truncated = complaint.length > COMPLAINT_PREVIEW_CHARS || complaint.includes("\n")
  // Engel varsa önce o (#913): başlıktaki düğme pasif, nedeni ilk okunan şey olsun.
  const blocked = Boolean(nextStep && nextStep.blockers.length > 0)
  const closed = status === "delivered" || status === "cancelled"
  const stepBlock = nextStep ? (
    <div className={detail.block}>
      <NextStepLine step={nextStep} onNavigate={onNavigate} />
    </div>
  ) : closed ? (
    <div className={detail.block}>
      <ClosedLine status={status} closedAt={closedAt} canReopen={canReopen} />
    </div>
  ) : null
  return (
    <section aria-label="Kabul özeti" className={cn(detail.shell, detail.summary)}>
      {blocked && stepBlock}
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
      {!blocked && stepBlock}
    </section>
  )
}

/**
 * Raydaki Durum kartı (#911, iki kolonda): durum hapı ve sıradaki adım.
 * Salt okunur — aksiyonlar başlıkta kalır. Hap panel başlığında (#912), kart
 * gövdesi sıradaki adımı ve onu kapatan engelleri taşır: ne eksik, hangileri,
 * ne yapılmalı ve Kalemler'e bağlantı (#913 — başlığın altındaki uyarı şeritleri
 * buraya taşındı). Kapanmış kabulde kapanış anını ve yeniden açma yolunu yazar.
 */
export function OrderStatusCard({
  status,
  nextStep,
  closedAt,
  canReopen = false,
  onNavigate,
}: {
  status: string
  nextStep: OrderNextStep | null
  /** Kapanmış kabulde kapanış anı (ISO); bilinmiyorsa tarih yazılmaz. */
  closedAt?: string
  /** Teslim edilmiş kabulü yeniden açma yetkisi (yalnız görünürlük; kapı action'da). */
  canReopen?: boolean
  onNavigate: (id: OrderSectionId) => void
}) {
  return (
    <DetailPanel title="Durum" aside={<OrderStatusPill status={status} />} className={detail.statusCard}>
      <div className={detail.block}>
        {nextStep ? (
          <NextStepLine step={nextStep} onNavigate={onNavigate} />
        ) : (
          <ClosedLine status={status} closedAt={closedAt} canReopen={canReopen} />
        )}
      </div>
    </DetailPanel>
  )
}
