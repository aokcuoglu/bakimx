/**
 * Paylaşılan mobil-öncelikli UI sınıf konvansiyonları.
 *
 * Bunlar `cn()` ile tüketilen saf class-string fragment'leridir — yeni bir
 * tasarım sistemi değil, mevcut shadcn/Tailwind tokenlerinin tutarlı kullanımı.
 * Amaç: dokunma hedefi, tipografi ve dikey ritmi tek kaynaktan yönetmek.
 */

/** Form input/select dokunma yüksekliği: mobilde 44px, masaüstünde 36px. */
export const INPUT_HEIGHT = "h-11 md:h-9"

/** Minimum dokunma hedefi (44px). İkincil ikon butonlar, satır aksiyonları. */
export const TOUCH_TARGET = "min-h-11 min-w-11"

/** Ana CTA / sabit alt "floor-action" buton yüksekliği (48px) — Button size="xl". */
export const FLOOR_ACTION = "h-12"

/** Sayfa başlığı tipografisi. */
export const pageTitle = "text-xl font-bold tracking-tight sm:text-2xl"

/** Bölüm başlığı tipografisi. */
export const sectionTitle = "text-base font-semibold sm:text-lg"

/** Kart/alan etiketi (küçük, sönük). */
export const cardLabel = "text-xs font-medium text-muted-foreground"

/** Sayfa içi standart dikey ritim. */
export const pageStack = "space-y-5"

/** Sabit/yapışkan alt elemanlar için gerçek safe-area padding'i (globals.css @utility). */
export const SAFE_BOTTOM = "safe-area-bottom"
