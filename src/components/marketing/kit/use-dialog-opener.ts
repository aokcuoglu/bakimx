"use client"

import { useCallback, useState } from "react"
import { useReturnFocus } from "@/hooks/use-return-focus"

/**
 * Dışarıdaki tetikleyicilerle açılan pencere durumu. Radix odağı yalnız kendi
 * `Dialog.Trigger`'ına döndürdüğü için açan öğe burada hatırlanır ve kapanışta
 * odaklanır (`useReturnFocus`); her açılışta `session` artar (form yeniden
 * kurulup sıfırlanır).
 */
export function useDialogOpener() {
  const [isOpen, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const { remember, onCloseAutoFocus } = useReturnFocus()

  const open = useCallback(
    (element: HTMLElement | null) => {
      remember(element)
      setSession((value) => value + 1)
      setOpen(true)
    },
    [remember],
  )

  return { isOpen, setOpen, session, open, onCloseAutoFocus }
}

/** Pencere açılınca ilk alanı (`input[name=…]`) odakla; Radix varsayılanı Kapat düğmesidir. */
export function focusFieldOnOpen(name: string) {
  return (event: Event) => {
    const field = (event.target as HTMLElement | null)?.querySelector<HTMLInputElement>(`input[name='${name}']`)
    if (!field) return
    event.preventDefault()
    field.focus()
  }
}
