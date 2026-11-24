"use client"

import { useEffect, useRef, useTransition, type ChangeEvent, type FormEvent, type MouseEvent } from "react"
import { useRouter } from "next/navigation"
import { buildOrderFilterSearch, buildOrderLoadMoreSearch } from "@/lib/orders/list-search"

/** Keep the toolbar mounted while the server applies the list filters. */
export function useOrderListNavigation(searchQuery: string) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, startLoadMore] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const submittedQuery = useRef<string | null>(null)

  function cancelSearch() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => {
    if (isPending || timer.current) return
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[name="q"]')
    // An older response must not replace text typed while it was loading.
    const isCurrentResponse = searchQuery === submittedQuery.current && input?.value === submittedQuery.current
    if (input && (submittedQuery.current === null || isCurrentResponse)) {
      input.value = searchQuery
      submittedQuery.current = null
    }
  }, [searchQuery, isPending])

  useEffect(() => {
    function onPopState() {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      const input = rootRef.current?.querySelector<HTMLInputElement>('input[name="q"]')
      submittedQuery.current = new URLSearchParams(window.location.search).get("q") ?? ""
      if (input) input.value = submittedQuery.current
    }
    window.addEventListener("popstate", onPopState)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      window.removeEventListener("popstate", onPopState)
    }
  }, [])

  function applyFilters(form: HTMLFormElement, replace: boolean) {
    cancelSearch()
    // Read the current DOM, including the latest select and table view values.
    const data = new FormData(form)
    const params = buildOrderFilterSearch(new URLSearchParams(window.location.search), data)
    submittedQuery.current = String(data.get("q") ?? "").trim()
    const href = `/orders${params.size ? `?${params}` : ""}`
    startTransition(() => {
      if (replace) router.replace(href, { scroll: false })
      else router.push(href, { scroll: false })
    })
  }

  /** Listeyi örten yükleme katmanı açılmadan pencereyi büyütür; `view` korunur. */
  function loadMore(nextLimit: number) {
    const params = buildOrderLoadMoreSearch(new URLSearchParams(window.location.search), nextLimit)
    startLoadMore(() => router.replace(`/orders?${params}`, { scroll: false }))
  }

  function onChange(event: ChangeEvent<HTMLDivElement>) {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.name !== "q" || !input.form) return
    cancelSearch()
    const form = input.form
    timer.current = setTimeout(() => applyFilters(form, true), 300)
  }

  function onSubmit(event: FormEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLFormElement) || event.target.id !== "order-list-filters") return
    event.preventDefault()
    applyFilters(event.target, false)
  }

  function onClick(event: MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]")
    if (!link || link.target || link.hasAttribute("download")) return
    const url = new URL(link.href)
    if (url.origin !== window.location.origin || url.pathname !== "/orders") return
    event.preventDefault()
    cancelSearch()
    submittedQuery.current = url.searchParams.get("q") ?? ""
    const input = rootRef.current?.querySelector<HTMLInputElement>('input[name="q"]')
    if (input) input.value = submittedQuery.current
    startTransition(() => router.push(`${url.pathname}${url.search}`, { scroll: false }))
  }

  return { rootRef, isPending, isLoadingMore, loadMore, onChange, onSubmit, onClick }
}
