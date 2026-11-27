/**
 * Sidebar'sız (odaklı) çalışma ekranları.
 *
 * Teknisyen paneli ve oradan açılan akışlar TELEFONDA (<lg) sidebar'sız kiosk
 * olarak çalışır: menü düğmesi yoktur, dönüş logodan / geri bağlantısından,
 * hesap/çıkış üst çubuktan yapılır. lg+ masaüstünde aynı rotalar normal kabukla
 * (sidebar + üst bar) görünür; ayrım JS ile değil CSS kırılımıyla yapılır
 * (`app-shell.tsx`). Panelden çıkan bir akış
 * (Araç Kabul kartı → `/orders/new?…&from=technician`) panelin parçası sayılır;
 * aynı sayfa ofisten (`from` yokken) açıldığında tam kabukla görünmeye devam eder.
 */

export const TECHNICIAN_FROM_PARAM = "from"
export const TECHNICIAN_FROM_VALUE = "technician"

/**
 * Teknisyen panelinin "Araç Kabul" hedefi: doğrudan plaka aramasıyla açılır ve
 * panelin görünümünü devralır. Hem kiosk tuşu hem sayfa başlığı düğmesi kullanır.
 */
export const TECHNICIAN_INTAKE_HREF = `/orders/new?entry=plate&${TECHNICIAN_FROM_PARAM}=${TECHNICIAN_FROM_VALUE}`

/** Panelden açılan ve panelin görünümünü devralan sayfalar. */
const TECHNICIAN_FLOW_PATHS: ReadonlySet<string> = new Set(["/orders/new"])

type SearchParamsLike = { get(name: string): string | null }

export function isTechnicianFlow(searchParams: SearchParamsLike | null | undefined): boolean {
  return searchParams?.get(TECHNICIAN_FROM_PARAM) === TECHNICIAN_FROM_VALUE
}

export function isSidebarlessRoute(
  pathname: string,
  searchParams?: SearchParamsLike | null,
): boolean {
  if (pathname === "/technician" || pathname.startsWith("/technician/")) return true
  return TECHNICIAN_FLOW_PATHS.has(pathname) && isTechnicianFlow(searchParams)
}
