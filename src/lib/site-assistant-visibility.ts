/**
 * Site asistanı yalnızca public/pazarlama sayfalarında görünür.
 * (app)/(auth)/admin ve satın-alma-sonrası yollarında render EDİLMEZ.
 */
const PUBLIC_PREFIXES = ["/fiyatlar", "/oto-servis-programi", "/dijital-arac-kabul", "/demo", "/satin-al", "/terms", "/privacy", "/destek"] as const;

export function isPublicAssistantPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
