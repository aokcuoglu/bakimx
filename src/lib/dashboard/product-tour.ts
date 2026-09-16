export type TourTargetId =
  | "welcome-banner"
  | "nav-orders"
  | "mobile-nav-orders"
  | "create-center"
  | "global-search"
  | "first-order"
  | "welcome-cta"

export type TourStepDef = {
  id: string
  title: string
  description: string
  /** Preferred target; first existing DOM node wins. */
  targets: TourTargetId[]
  /** Preferred popover side relative to the target. */
  side?: "top" | "bottom" | "left" | "right"
}

const INTRO_STEP: TourStepDef = {
  id: "intro",
  title: "Panele hoş geldiniz",
  description:
    "Kısa bir turla Genel Bakış, iş emirleri, hızlı oluşturma ve aramayı tanıyalım. İstediğiniz zaman Atla diyebilirsiniz.",
  targets: [],
  side: "bottom",
}

const DESKTOP_STEPS: TourStepDef[] = [
  INTRO_STEP,
  {
    id: "orders",
    title: "İş Emirleri",
    description:
      "Servisin omurgası burası. Açık işleri takip eder, durum günceller ve teslimata kadar ilerlersiniz.",
    targets: ["nav-orders"],
    side: "right",
  },
  {
    id: "create",
    title: "Yeni kayıt",
    description:
      "Müşteri, araç veya iş emrini tek yerden hızlıca oluşturun — günlük işin en kısa yolu.",
    targets: ["create-center"],
    side: "bottom",
  },
  {
    id: "search",
    title: "Arama",
    description: "Plaka, müşteri adı veya iş emri numarasıyla kayıtlara anında ulaşın.",
    targets: ["global-search"],
    side: "bottom",
  },
  {
    id: "first-order",
    title: "İlk iş emriniz",
    description:
      "İlk müşteriyi ve aracı kaydedip iş emri açarak başlayın. Hazırsanız buradan devam edin.",
    targets: ["first-order", "welcome-cta", "welcome-banner"],
    side: "bottom",
  },
]

const MOBILE_STEPS: TourStepDef[] = [
  INTRO_STEP,
  {
    id: "orders",
    title: "İş Emirleri",
    description:
      "Alt menüden iş emirlerine geçin. Açık işleri takip eder ve teslimata kadar ilerlersiniz.",
    targets: ["mobile-nav-orders"],
    side: "top",
  },
  {
    id: "create",
    title: "Yeni kayıt",
    description:
      "Üstteki oluştur düğmesiyle müşteri, araç veya iş emrini hızlıca ekleyin.",
    targets: ["create-center"],
    side: "bottom",
  },
  {
    id: "search",
    title: "Arama",
    description: "Büyüteç ile plaka, müşteri veya iş emri arayın.",
    targets: ["global-search"],
    side: "bottom",
  },
  {
    id: "first-order",
    title: "İlk iş emriniz",
    description:
      "İlk müşteriyi ve aracı kaydedip iş emri açarak başlayın. Hazırsanız buradan devam edin.",
    targets: ["first-order", "welcome-cta", "welcome-banner"],
    side: "top",
  },
]

export function getDashboardTourSteps(isMobile: boolean): TourStepDef[] {
  return isMobile ? MOBILE_STEPS : DESKTOP_STEPS
}

export function tourTargetSelector(id: TourTargetId): string {
  return `[data-tour="${id}"]`
}

/** Resolve the first matching target element for a step. Empty targets = centered intro (no spotlight). */
export function findTourTarget(targets: TourTargetId[], root: ParentNode = document): HTMLElement | null {
  if (targets.length === 0) return null
  for (const id of targets) {
    const el = root.querySelector(tourTargetSelector(id))
    if (el instanceof HTMLElement && el.getBoundingClientRect().width > 0) return el
  }
  return null
}

export function isIntroStep(step: TourStepDef): boolean {
  return step.targets.length === 0
}

/**
 * Advance index while skipping steps whose targets are missing from the DOM.
 * Returns null when no remaining step has a visible target.
 */
export function nextAvailableStepIndex(
  steps: TourStepDef[],
  fromIndex: number,
  direction: 1 | -1,
  hasTarget: (step: TourStepDef) => boolean,
): number | null {
  let i = fromIndex
  while (i >= 0 && i < steps.length) {
    if (hasTarget(steps[i]!)) return i
    i += direction
  }
  return null
}

export const DASHBOARD_TOUR_API = "/api/account/dashboard-tour"
