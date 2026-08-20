import { buildLlmsTxt } from "@/lib/llms"

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: {
      "Cache-Control": "public, max-age=3600, must-revalidate",
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
