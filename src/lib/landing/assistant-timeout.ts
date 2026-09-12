import { askLandingAssistant, LANDING_ASSISTANT_TIMEOUT_MS } from "@/lib/landing/assistant-ai"

export async function askWithTimeout(
  question: string,
  timeoutMs: number = LANDING_ASSISTANT_TIMEOUT_MS,
  ask: typeof askLandingAssistant = askLandingAssistant,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await ask(question, controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}
