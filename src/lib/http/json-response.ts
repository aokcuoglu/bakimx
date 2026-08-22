import type { ZodType } from "zod"

const INVALID_JSON_RESPONSE_MESSAGE = "Sunucudan geçersiz yanıt alındı. Lütfen tekrar denemeden önce destek ekibine bildirin."

export async function readJsonObject<T>(response: Response, schema: ZodType<T>): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (!contentType.includes("application/json")) throw new Error(INVALID_JSON_RESPONSE_MESSAGE)

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error(INVALID_JSON_RESPONSE_MESSAGE)
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) throw new Error(INVALID_JSON_RESPONSE_MESSAGE)
  return parsed.data
}
