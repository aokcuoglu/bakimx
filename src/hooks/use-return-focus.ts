"use client"

import { useCallback, useRef, type RefObject } from "react"

/**
 * Odağın döneceği yer. Pencere açıkken yeniden bağlanan bir açıcı (ör. yalnız
 * düzenleme kapalıyken çizilen kalem düğmesi) ref olarak verilir: öğenin
 * kendisi kapanışta DOM'da olmaz, ref yeni öğeyi gösterir.
 */
export type FocusReturnTarget = HTMLElement | RefObject<HTMLElement | null>

type Focusable = { readonly isConnected: boolean; focus: (options?: FocusOptions) => void }

/**
 * `onCloseAutoFocus`ın saf çekirdeği: hedef hâlâ DOM'daysa Radix'in varsayılanını
 * durdurur ve odağı hedefe verir. Hedef yoksa ya da DOM'dan kalktıysa hiçbir şey
 * yapmaz — Radix'in kendi davranışı (tetikleyiciye dönüş) sürer.
 */
export function returnFocusTo(
  event: Pick<Event, "preventDefault">,
  target: Focusable | { readonly current: Focusable | null } | null,
  options?: FocusOptions,
): boolean {
  const element = target && "current" in target ? target.current : target
  if (!element?.isConnected) return false
  event.preventDefault()
  element.focus(options)
  return true
}

/**
 * Kontrollü (tetikleyicisiz) pencere kapanınca odağı açan öğeye döndürür.
 * Radix modal `Dialog.Content` odağı yalnız kendi `Dialog.Trigger`ına döndürür;
 * dışarıdaki bir düğmeyle açılan pencere kapanınca odak `BODY`ye düşer.
 *
 * Açan yol `remember(öğe)` çağırır (öğe verilmezse `document.activeElement`),
 * pencere `onCloseAutoFocus={onCloseAutoFocus}` alır. Hatırlanan hedef bir kez
 * kullanılır: hatırlamadan açılan bir sonraki pencere eski bir öğeye atlamaz.
 */
export function useReturnFocus({
  preventScroll,
  initial = null,
}: {
  /**
   * Açan öğe sayfanın başka bir yerindeyse (hızlı işlem → bölüme kaydırma) odak
   * dönerken sayfa geri kaymasın: kullanıcı sonucu kaydırılan bölümde görür.
   */
  preventScroll?: boolean
  /** Pencere ilk çizimde açık geliyorsa (ör. `?edit=1`) kapanınca dönülecek yer. */
  initial?: FocusReturnTarget | null
} = {}) {
  const target = useRef<FocusReturnTarget | null>(initial)

  const remember = useCallback((next?: Element | FocusReturnTarget | null) => {
    const value = next === undefined ? document.activeElement : next
    target.current = value && ("current" in value || value instanceof HTMLElement) ? value : null
  }, [])

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      const next = target.current
      target.current = null
      returnFocusTo(event, next, preventScroll === undefined ? undefined : { preventScroll })
    },
    [preventScroll],
  )

  return { remember, onCloseAutoFocus }
}
