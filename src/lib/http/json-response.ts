const INVALID_JSON_RESPONSE_MESSAGE = "Sunucudan geçersiz yanıt alındı. Lütfen tekrar denemeden önce destek ekibine bildirin."

export async function readJsonObject<T extends Record<string, unknown> = Record<string, unknown>>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (!contentType.includes("application/json")) throw new Error(INVALID_JSON_RESPONSE_MESSAGE)

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error(INVALID_JSON_RESPONSE_MESSAGE)
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new Error(INVALID_JSON_RESPONSE_MESSAGE)
  }
  return body as T
}
