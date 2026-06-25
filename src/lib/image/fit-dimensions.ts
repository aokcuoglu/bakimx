/** Oranı koruyarak uzun kenarı maxEdge'e indirir; zaten küçükse büyütmez. */
export function fitDimensions(w: number, h: number, maxEdge: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 }
  const longest = Math.max(w, h)
  if (longest <= maxEdge) return { w: Math.round(w), h: Math.round(h) }
  const scale = maxEdge / longest
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}
