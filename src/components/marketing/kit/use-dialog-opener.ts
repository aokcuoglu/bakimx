"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Dışarıdaki tetikleyicilerle açılan pencere durumu. Radix odağı yalnız kendi
 * `Dialog.Trigger`'ına döndürdüğü için açan öğe burada hatırlanır ve kapanışta
 * odaklanır; her açılışta `session` artar (form yeniden kurulup sıfırlanır).
 */
export function useDialogOpener() {
  const [isOpen, setOpen] = useState(false)
  const [session, setSession] = useState(0)
  const opener = useRef<HTMLElement | null>(null)

  const open = useCallback((element: HTMLElement | null) => {
    opener.current = element
    setSession((value) => value + 1)
    setOpen(true)
  }, [])

  const onCloseAutoFocus = useCallback((event: Event) => {
    if (!opener.current?.isConnected) return
    event.preventDefault()
    opener.current.focus()
  }, [])

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
