"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import {
  DASHBOARD_TOUR_API,
  findTourTarget,
  getDashboardTourSteps,
  isIntroStep,
  type TourStepDef,
} from "@/lib/dashboard/product-tour"

type Rect = { top: number; left: number; width: number; height: number }

const PAD = 6
const CARD_WIDTH = 320
const CARD_GAP = 12

function measure(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

function placeCard(
  target: Rect,
  side: TourStepDef["side"],
  viewportW: number,
  viewportH: number,
): { top: number; left: number } {
  const cardH = 200
  let top = target.top + target.height + CARD_GAP
  let left = target.left

  if (side === "top") {
    top = target.top - cardH - CARD_GAP
  } else if (side === "right") {
    top = target.top
    left = target.left + target.width + CARD_GAP
  } else if (side === "left") {
    top = target.top
    left = target.left - CARD_WIDTH - CARD_GAP
  }

  left = Math.min(Math.max(12, left), viewportW - CARD_WIDTH - 12)
  top = Math.min(Math.max(12, top), viewportH - cardH - 12)
  return { top, left }
}

function centerCard(viewportW: number, viewportH: number): { top: number; left: number } {
  const cardH = 200
  return {
    top: Math.max(24, (viewportH - cardH) / 2),
    left: Math.max(12, (viewportW - CARD_WIDTH) / 2),
  }
}

async function persistTourComplete() {
  try {
    await fetch(DASHBOARD_TOUR_API, { method: "POST", keepalive: true })
  } catch {
    /* Network failure: local dismiss still applies for this session. */
  }
}

function rAF(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

export function DashboardProductTour({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const steps = useMemo(() => getDashboardTourSteps(isMobile), [isMobile])
  const [dismissed, setDismissed] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null)
  const [measuredStepId, setMeasuredStepId] = useState<string | null>(null)

  const active = enabled && !dismissed && pathname === "/dashboard"
  const step = steps[stepIndex] ?? null
  const intro = step ? isIntroStep(step) : false

  const dismiss = useCallback(async () => {
    await persistTourComplete()
    setDismissed(true)
    setTargetRect(null)
    setCardPos(null)
    setMeasuredStepId(null)
  }, [])

  useEffect(() => {
    if (!active) return
    const frame = requestAnimationFrame(() => setStepIndex(0))
    return () => cancelAnimationFrame(frame)
  }, [active, isMobile])

  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault()
        void dismiss()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [active, dismiss])

  useEffect(() => {
    if (!active || !step) {
      const frame = requestAnimationFrame(() => {
        setTargetRect(null)
        setCardPos(null)
        setMeasuredStepId(null)
      })
      return () => cancelAnimationFrame(frame)
    }

    if (isIntroStep(step)) {
      const frame = requestAnimationFrame(() => {
        setTargetRect(null)
        setCardPos(centerCard(window.innerWidth, window.innerHeight))
        setMeasuredStepId(step.id)
      })
      return () => cancelAnimationFrame(frame)
    }

    let cancelled = false
    const stepId = step.id

    function apply(el: HTMLElement) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
      const rect = measure(el)
      setTargetRect(rect)
      setCardPos(placeCard(rect, step!.side ?? "bottom", window.innerWidth, window.innerHeight))
      setMeasuredStepId(stepId)
    }

    const observer = new MutationObserver(() => {
      const el = findTourTarget(step!.targets)
      if (el) apply(el)
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-tour"],
    })

    void (async () => {
      for (let i = 0; i < 180; i++) {
        if (cancelled) return
        const el = findTourTarget(step!.targets)
        if (el) {
          apply(el)
          return
        }
        await rAF()
      }
      if (cancelled) return
      // Missing DOM target: advance when possible. Never auto-complete — that
      // silently wrote dashboardTourCompletedAt while the user saw no tour.
      if (stepIndex < steps.length - 1) {
        setMeasuredStepId(null)
        setStepIndex((i) => i + 1)
        return
      }
      setTargetRect(null)
      setCardPos(centerCard(window.innerWidth, window.innerHeight))
      setMeasuredStepId(stepId)
    })()

    function onViewportChange() {
      const el = findTourTarget(step!.targets)
      if (el) apply(el)
    }
    window.addEventListener("resize", onViewportChange)
    window.addEventListener("scroll", onViewportChange, true)
    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener("resize", onViewportChange)
      window.removeEventListener("scroll", onViewportChange, true)
    }
  }, [active, step, stepIndex, steps.length, dismiss])

  if (!active || !step || !cardPos || measuredStepId !== step.id) return null
  // Intro and last-step fallback are centered (no spotlight); other steps need a target.
  const showSpotlight = Boolean(targetRect)
  if (!intro && !showSpotlight && stepIndex < steps.length - 1) return null

  const isLast = stepIndex >= steps.length - 1
  const canGoBack = stepIndex > 0

  function goNext() {
    if (isLast) {
      void dismiss()
      return
    }
    setMeasuredStepId(null)
    setStepIndex((i) => i + 1)
  }

  function goBack() {
    setMeasuredStepId(null)
    setStepIndex((i) => Math.max(i - 1, 0))
  }

  return (
    <div className="contents" aria-live="polite">
      <div
        className={cn("fixed inset-0 z-[45]", !showSpotlight ? "bg-foreground/50" : undefined)}
        aria-hidden
        onClick={(e) => e.stopPropagation()}
      />

      {showSpotlight && targetRect ? (
        <div
          className={cn(
            "pointer-events-none fixed z-[46] rounded-lg ring-2 ring-background",
            "shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]",
          )}
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
          }}
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-tour-title"
        aria-describedby="dashboard-tour-desc"
        className="fixed z-[47] w-[min(100vw-1.5rem,20rem)] rounded-xl border border-border bg-card p-4 shadow-lg"
        style={{ top: cardPos.top, left: cardPos.left }}
      >
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Tanıtım · {stepIndex + 1} / {steps.length}
        </p>
        <h2 id="dashboard-tour-title" className="mt-1 text-base font-semibold text-foreground">
          {step.title}
        </h2>
        <p id="dashboard-tour-desc" className="mt-1.5 text-sm text-muted-foreground">
          {step.description}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => void dismiss()}>
            Atla
          </Button>
          <div className="flex-1" />
          {canGoBack && (
            <Button type="button" variant="outline" size="sm" onClick={goBack}>
              Geri
            </Button>
          )}
          <Button type="button" variant="foreground" size="sm" onClick={goNext}>
            {isLast ? "Bitir" : "İleri"}
          </Button>
        </div>
      </div>
    </div>
  )
}
