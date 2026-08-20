/**
 * Radix overlay'leri ile hâlâ Base UI üzerinde duran iki bileşen (Combobox,
 * Autocomplete) arasındaki Escape köprüsü.
 *
 * Neden gerekli: Radix `DismissableLayer` Escape'i **document üzerinde capture
 * fazında** dinliyor (`@radix-ui/react-dismissable-layer/dist/index.mjs:105`),
 * yani dinleyicisi diyaloğun İÇİNDEKİ hiçbir handler'dan önce çalışır. Base UI
 * popup'ı açıkken basılan tek Escape hem popup'ı hem diyaloğu kapatıyordu —
 * ölçüldü (BAK-155 kapsam dışı bulgu 1). `stopPropagation()` çare değil: olay
 * Radix'e zaten ulaşmış oluyor. Radix'in kendi kaçış kapısı `onEscapeKeyDown` +
 * `preventDefault()`; `preventDefault` yalnız Radix'in `onDismiss`ini iptal eder,
 * olay yayılmaya devam ettiği için Base UI kendi popup'ını yine kapatır.
 */

/** Base UI popup'ları portal'a çıkar ve yalnız AÇIKKEN DOM'da bulunur. */
export const BASE_UI_POPUP_SELECTOR =
  '[data-slot="combobox-content"],[data-slot="autocomplete-content"]'

/** Ekranda açık bir Base UI popup'ı var mı? */
export function isBaseUIPopupOpen(): boolean {
  if (typeof document === "undefined") return false
  return document.querySelector(BASE_UI_POPUP_SELECTOR) !== null
}

/**
 * Radix overlay'lerinin (`Dialog`, `Sheet`, `AlertDialog`) varsayılan
 * `onEscapeKeyDown`'u: açık bir Base UI popup'ı varsa ilk Escape'i ona bırakır.
 * Çağıranın kendi handler'ı önce çalışır ve `preventDefault` ederse karışmayız.
 *
 * Kapsam notu: kontrol DOM genelinde. Sayfada başka bir yerde açık bir Base UI
 * popup'ı varken diyaloğun ilk Escape'i de yutulur — popup açık kalması odak
 * gerektirdiği için pratikte oluşmuyor, ama Combobox/Autocomplete Radix'e
 * taşındığında bu dosyanın tamamı silinmeli.
 */
export function yieldEscapeToBaseUIPopup(
  event: KeyboardEvent,
  onEscapeKeyDown?: (event: KeyboardEvent) => void
): void {
  onEscapeKeyDown?.(event)
  if (event.defaultPrevented) return
  if (isBaseUIPopupOpen()) event.preventDefault()
}
