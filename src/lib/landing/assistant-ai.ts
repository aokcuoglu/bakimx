import { getLandingAssistantProvider } from "@/lib/landing/assistant-provider"
import { getAssistantAnswerById, type AssistantAnswer } from "./assistant-answers"

export const LANDING_ASSISTANT_TIMEOUT_MS = 8_000

export type LandingAssistantAnswer = {
  answer: string
  sources: AssistantAnswer[]
}

export async function askLandingAssistant(
  question: string,
  signal?: AbortSignal,
): Promise<LandingAssistantAnswer | null> {
  const provider = getLandingAssistantProvider()
  const result = await provider.ask(question, signal)
  const sources = [...new Set(result.sourceIds)]
    .map(getAssistantAnswerById)
    .filter((source): source is AssistantAnswer => Boolean(source))

  // Kaynaksız bir cümle gösterilmez: sağlayıcı yanlış biçimde cevap üretse bile
  // corpus dışı cevap kullanıcıya ulaşmaz.
  const answer = result.answer?.trim()
  const grounded = answer && sources.length > 0 ? { answer, sources } : null
  console.info("[landing-assistant]", JSON.stringify({
    question,
    answer: grounded?.answer ?? null,
    sourceIds: sources.map((source) => source.id),
    provider: result.provider,
  }))
  return grounded
}
