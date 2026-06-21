/**
 * Minimal HTML escaping for values interpolated into raw HTML strings
 * (e.g. the server-rendered share/PDF routes that build HTML via template
 * literals). React/JSX escapes automatically — only use this where we build
 * HTML by hand. Escapes the five characters that can break out of text or
 * attribute contexts.
 */
export function escapeHtml(value: unknown): string {
  if (value == null) return ""
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
