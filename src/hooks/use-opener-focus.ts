"use client"

import { useCallback, useState } from "react"
import { returnFocusTo } from "@/hooks/use-return-focus"

type OpenerDocument = {
  activeElement: unknown
  body: unknown
  getElementById: (id: string) => unknown
}
type OpenerElement = {
  readonly isConnected: boolean
  focus: (options?: FocusOptions) => void
  closest?: (selector: string) => { getAttribute: (name: string) => string | null } | null
}

/** Pencere açılırken odağı tutan öğe; menü maddesiyse ayrıca menünün tetikleyici kimliği. */
export type OpenerSnapshot = { element: OpenerElement | null; menuTriggerId: string | null }

const EMPTY: OpenerSnapshot = { element: null, menuTriggerId: null }

function isOpenerElement(value: unknown): value is OpenerElement {
  return typeof value === "object" && value !== null && "focus" in value && "isConnected" in value
}

/**
 * Pencerenin ilk çiziminde (Radix odağı içeri almadan önce) odağı tutan öğeyi alır.
 * `BODY` hedef olmaz (Safari fare tıklamasında düğmeye odak vermez). Öğe bir
 * menü maddesiyse menü seçimle birlikte DOM'dan kalkar; menünün tetikleyicisinin
 * kimliği (`role="menu"` → `aria-labelledby`) yedek olarak saklanır.
 */
export function captureOpener(doc: OpenerDocument): OpenerSnapshot {
  const active = doc.activeElement
  if (!isOpenerElement(active) || active === doc.body) return EMPTY
  const menuTriggerId = active.closest?.('[role="menu"]')?.getAttribute("aria-labelledby") ?? null
  return { element: active, menuTriggerId }
}

/** Kapanışta odağın döneceği adaylar: önce açan öğe, o kalktıysa menünün tetikleyicisi. */
export function openerCandidates(snapshot: OpenerSnapshot, doc: Pick<OpenerDocument, "getElementById">) {
  const trigger = snapshot.menuTriggerId ? doc.getElementById(snapshot.menuTriggerId) : null
  return [snapshot.element, isOpenerElement(trigger) ? trigger : null]
}

/**
 * Radix modal `Content` odağı yalnız kendi `Trigger`ına döndürür; menü maddesinden
 * ya da koddan açılan (kontrollü) pencere kapanınca odak `BODY`ye düşer. Paylaşılan
 * `DialogContent` / `SheetContent` / `AlertDialogContent` bunu çağırır: açan öğe
 * ilk çizimde yakalanır, kapanışta DOM'daysa odaklanır. Çağıranın
 * `onCloseAutoFocus`ı önce çalışır ve `preventDefault` ederse karışılmaz. Açan
 * öğe de menü tetikleyicisi de yoksa Radix'in varsayılanı sürer.
 */
export function useOpenerFocus(onCloseAutoFocus?: (event: Event) => void) {
  const [snapshot] = useState<OpenerSnapshot>(() =>
    typeof document === "undefined" ? EMPTY : captureOpener(document),
  )
  return useCallback(
    (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented) return
      returnFocusTo(event, openerCandidates(snapshot, document))
    },
    [onCloseAutoFocus, snapshot],
  )
}
