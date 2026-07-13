/**
 * Next.js startup hook — runs once when the server process boots. Used only for
 * the provider-env sanity banner (see provider-env-check). Kept to the nodejs
 * runtime; the edge runtime never touches the paid providers.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { checkProviderEnvAtStartup } = await import("@/lib/startup/provider-env-check")
  checkProviderEnvAtStartup()
}
