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
                  size="sm"
                  className="h-auto min-h-8 w-full flex-col items-stretch gap-1 px-1 py-1"
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
                  size="sm"
                  className="h-8 justify-start px-1 text-left font-medium text-muted-foreground hover:text-foreground"
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
}: {
  eyebrow?: string
  title: string
  description?: string
}) {
  return (
    <div className="space-y-1">
      {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
      <h2 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

/**
 * Seçenek kartı: büyük dokunma alanı, ikon, başlık, açıklama ve sağ üstte seçim
 * göstergesi. Kartın kendisi düğmedir — mobilde tüm kart tıklanabilir olsun diye.
 */
export function WizardChoiceCard({
  icon,
  title,
  description,
  selected = false,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  selected?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative h-auto md:h-auto w-full flex-col items-start gap-2 whitespace-normal p-4 text-left ${
        selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/50 hover:bg-primary/5"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-3 right-3 flex size-5 items-center justify-center rounded-full border ${
          selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
        }`}
      >
        {selected && <Check className="size-3" />}
      </span>
      <span
        className={`flex size-10 items-center justify-center rounded-lg ${
          selected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary-strong"
        }`}
      >
        {icon}
      </span>
      <span className="block pr-6 text-sm font-semibold text-foreground">{title}</span>
      <span className="block text-xs font-normal text-muted-foreground">{description}</span>
    </Button>
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
        ? "fixed inset-x-0 bottom-16 z-20 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:bottom-0 sm:px-6 lg:left-(--sidebar-width) lg:transition-[left] lg:group-data-[sidebar-state=collapsed]/sidebar-wrapper:left-(--sidebar-width-icon)"
        : "flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"
    }>
      <div>{back}</div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}
