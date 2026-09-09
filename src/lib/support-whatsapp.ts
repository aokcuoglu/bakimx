/** Company sales/support only. Workshop/customer sharing has separate helpers. */
export function getSupportWhatsAppUrl(message: string): string {
  // Keep the direct env access: Next.js replaces it in the browser bundle at build time.
  const phone = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim() || "905423681438"
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}
