"use client"

import { useCallback, useRef, type RefObject } from "react"

/**
 * Odağın döneceği yer. Pencere açıkken yeniden bağlanan bir açıcı (ör. yalnız
 * düzenleme kapalıyken çizilen kalem düğmesi) ref olarak verilir: öğenin
 * kendisi kapanışta DOM'da olmaz, ref yeni öğeyi gösterir.
 */
export type FocusReturnTarget = HTMLElement | RefObject<HTMLElement | null>

type Focusable = { readonly isConnected: boolean; focus: (options?: FocusOptions) => void }
type FocusCandidate = Focusable | { readonly current: Focusable | null } | null | undefined

/**
 * `onCloseAutoFocus`ın saf çekirdeği: adaylardan DOM'da kalan ilkine odak verir ve
 * Radix'in varsayılanını durdurur. Hiçbiri yoksa ya da hepsi DOM'dan kalktıysa
 * hiçbir şey yapmaz — Radix'in kendi davranışı (tetikleyiciye dönüş) sürer.
 */
export function returnFocusTo(
  event: Pick<Event, "preventDefault">,
  targets: FocusCandidate | readonly FocusCandidate[],
  options?: FocusOptions,
): boolean {
  const list = Array.isArray(targets) ? targets : [targets]
  for (const target of list as readonly FocusCandidate[]) {
    const element = target && "current" in target ? target.current : target
    if (!element?.isConnected) continue
    event.preventDefault()
    element.focus(options)
    return true
  }
  return false
}

/**
 * Kontrollü (tetikleyicisiz) pencere kapanınca odağı açan öğeye döndürür.
 * Radix modal `Dialog.Content` odağı yalnız kendi `Dialog.Trigger`ına döndürür;
 * dışarıdaki bir düğmeyle açılan pencere kapanınca odak `BODY`ye düşer.
 *
 * Açan yol `remember(öğe, yedek?)` çağırır, pencere
 * `onCloseAutoFocus={onCloseAutoFocus}` alır. Öğe verilmezse
 * `document.activeElement` denenir; `BODY` hiçbir zaman hedef olmaz (Safari fare
 * tıklamasında düğmeye odak vermez, etkin öğe BODY kalır). Açan öğe kapanışta
 * DOM'dan kalkmışsa (ör. kaydedilince kaybolan "Bilgi ekle") yedeğe dönülür.
 * Hatırlanan hedef bir kez kullanılır: hatırlamadan açılan bir sonraki pencere
 * eski bir öğeye atlamaz.
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
  const targets = useRef<(FocusReturnTarget | null)[]>([initial])

  const remember = useCallback(
    (next?: Element | FocusReturnTarget | null, fallback?: FocusReturnTarget | null) => {
      const value = next === undefined ? document.activeElement : next
      const usable =
        value && ("current" in value || (value instanceof HTMLElement && value !== document.body)) ? value : null
      targets.current = [usable, fallback ?? null]
    },
    [],
  )

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      const list = targets.current
      targets.current = []
      returnFocusTo(event, list, preventScroll === undefined ? undefined : { preventScroll })
    },
    [preventScroll],
  )

  return { remember, onCloseAutoFocus }
}
