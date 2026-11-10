export const ONBOARDING_STEPS = [
  { slug: "sektor", label: "Sektör seçimi" },
  { slug: "is-detaylari", label: "İş detayları" },
  { slug: "ekip", label: "Ekip büyüklüğü" },
  { slug: "moduller", label: "Modül seçimi" },
] as const

export const FIRST_ONBOARDING_PATH = "/onboarding/sektor"

export function onboardingStepIndex(pathname: string): number {
  return ONBOARDING_STEPS.findIndex(({ slug }) => pathname === `/onboarding/${slug}`)
}

export function onboardingStepPath(index: number): string {
  return `/onboarding/${ONBOARDING_STEPS[index].slug}`
}
