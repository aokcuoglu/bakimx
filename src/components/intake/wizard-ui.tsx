"use client"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

export type WizardStep = { id: string; label: string }

/**
 * Sihirbaz adım rayı (#309). Masaüstünde numaralı dikey ray, mobilde tek satırlık
 * yatay şerit — kabul akışı telefonda kullanıldığı için ray asla dikey yer yemez.
 * Salt-görüntü değildir: tamamlanmış adımlara geri dönülebilir (`onStepClick`).
 */
export function WizardStepper({
  steps,
  currentId,
  completedIds,
  onStepClick,
  compact = false,
  className = "",
}: {
  steps: WizardStep[]
  currentId: string
  completedIds: string[]
  onStepClick?: (id: string) => void
  /** Her genişlikte yatay şerit — iç içe sihirbazlarda ikinci dikey ray olmasın diye. */
  compact?: boolean
  className?: string
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentId)
  const done = new Set(completedIds)

  return (
    <nav aria-label="Adımlar" className={className}>
      {/* Mobil (ve compact): yatay şerit */}
      <ol className={`flex items-center gap-1.5 ${compact ? "" : "lg:hidden"}`}>
        {steps.map((s, i) => {
          const isCurrent = s.id === currentId
          const state = isCurrent ? "current" : done.has(s.id) ? "done" : i < currentIndex ? "past" : "todo"
          const reachable = (state === "done" || state === "past") && !!onStepClick
          const bar = (
            <span
              aria-hidden
              className={`h-1.5 rounded-full ${
                state === "todo" ? "bg-muted" : state === "current" ? "bg-primary" : "bg-primary/40"
              }`}
            />
          )
          return (
            <li key={s.id} className="flex min-w-0 flex-1 flex-col gap-1">
              {reachable ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="w-full flex-col items-stretch gap-1 px-1"
                  onClick={() => onStepClick(s.id)}
                >
                  {bar}
                  <span className="sr-only">
                    {i + 1}. {s.label} — bu adıma dön
                  </span>
                </Button>
              ) : (
                bar
              )}
              {isCurrent && (
                <span
                  className="truncate text-xs font-medium text-foreground"
                  aria-current="step"
                >
                  {i + 1}. {s.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>

      {/* Masaüstü: numaralı dikey ray */}
      <ol className={compact ? "hidden" : "hidden lg:block"}>
        {steps.map((s, i) => {
          const isCurrent = s.id === currentId
          const isDone = done.has(s.id)
          const reachable = isDone || i < currentIndex
          const last = i === steps.length - 1
          return (
            <li key={s.id} className="relative flex gap-3 pb-6 last:pb-0">
              {!last && (
                <span
                  aria-hidden
                  className={`absolute top-8 left-[15px] h-[calc(100%-2rem)] w-px ${isDone ? "bg-primary/40" : "bg-border"}`}
                />
              )}
              <span
                aria-hidden
                className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : isDone
                      ? "border-primary/40 bg-primary/10 text-primary-strong"
                      : "border-border bg-card text-muted-foreground"
                }`}
              >
                {isDone && !isCurrent ? <Check className="size-4" /> : i + 1}
              </span>
              {reachable && onStepClick ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="justify-start px-1 text-left text-muted-foreground hover:text-foreground"
                  onClick={() => onStepClick(s.id)}
                >
                  {s.label}
                </Button>
              ) : (
                <span
                  className={`self-center text-sm ${isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {s.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** Adım başlığı: "Adım N" üst etiketi + soru cümlesi + açıklama. */
export function WizardHeading({
  eyebrow,
  title,
  description,
  large = false,
}: {
  eyebrow?: string
  title: string
  description?: string
  /** Odaklı (tek iş) ekranlar için büyük ölçek. */
  large?: boolean
}) {
  return (
    <div className={large ? "space-y-2" : "space-y-1"}>
      {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
      <h2 className={large ? "text-2xl font-bold tracking-tight text-foreground sm:text-3xl" : "text-xl font-bold text-foreground sm:text-2xl"}>{title}</h2>
      {description && <p className={large ? "text-lg leading-snug text-muted-foreground" : "text-sm text-muted-foreground"}>{description}</p>}
    </div>
  )
}

/** Adım alt çubuğu: solda Geri, sağda ileri/eylem düğmeleri. */
export function WizardActions({
  back,
  children,
  sticky = false,
}: {
  back?: ReactNode
  children?: ReactNode
  /** İş akışı ekranlarında sonraki adıma geçiş her zaman viewport'un altında kalır. */
  sticky?: boolean
}) {
  return (
    <div className={
      sticky
        ? "fixed inset-x-0 bottom-16 z-20 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:bottom-0 sm:px-6 lg:left-(--sidebar-width) lg:transition-[left] lg:group-data-[sidebar-state=collapsed]/sidebar-wrapper:left-0"
        : "flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"
    }>
      <div>{back}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
