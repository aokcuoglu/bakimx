"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Loader2, Plus, User } from "lucide-react"
import type { UnifiedResult } from "@/lib/search/unified-results"
import { formatPhoneTR, toTrUpper } from "@/lib/format"

type CustomerHit = Extract<UnifiedResult, { kind: "customer" }>
const SEARCH_ENDPOINT = "/api/search/customer-vehicle"

export function CustomerSearchOrCreate({
  onSelected,
  autoFocus,
  initialName,
}: {
  onSelected: (customerId: string, label: string) => void
  autoFocus?: boolean
  /** Pre-fills the "new customer" name (e.g. owner read from a ruhsat scan). */
  initialName?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CustomerHit[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [type, setType] = useState<"individual" | "corporate">("individual")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [phone, setPhone] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  // When the entered phone already belongs to a customer, offer to select them
  // instead of creating a duplicate (a phone belongs to a single customer).
  const [duplicate, setDuplicate] = useState<{ id: string; label: string } | null>(null)

  useEffect(() => {
    if (creating || query.trim().length < 1) {
      const t = setTimeout(() => { setResults([]); setLoading(false) }, 0)
      return () => clearTimeout(t)
    }
    let active = true
    const t = setTimeout(() => {
      setLoading(true)
      fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          if (!active) return
          const list: UnifiedResult[] = Array.isArray(d?.results) ? d.results : []
          setResults(list.filter((x): x is CustomerHit => x.kind === "customer"))
        })
        .catch(() => { if (active) setResults([]) })
        .finally(() => { if (active) setLoading(false) })
    }, 250)
    return () => { active = false; clearTimeout(t) }
  }, [query, creating])

  function openCreate() {
    const seed = (query.trim() || initialName || "").trim()
    const parts = seed.split(/\s+/)
    setType("individual")
    setFirstName(toTrUpper(parts[0] || ""))
    setLastName(toTrUpper(parts.slice(1).join(" ")))
    setCompanyName("")
    setPhone("")
    setBusy(false)
    setError("")
    setDuplicate(null)
    setCreating(true)
  }

  async function handleCreate() {
    setError("")
    setDuplicate(null)
    if (!phone.trim()) { setError("Telefon zorunludur"); return }
    if (type === "individual" && !firstName.trim()) { setError("Ad zorunludur"); return }
    if (type === "corporate" && !companyName.trim()) { setError("Şirket adı zorunludur"); return }
    setBusy(true)
    try {
      const cf = new FormData()
      cf.set("type", type)
      // Send fullName so the server's superRefine accepts an individual with no
      // surname (Soyad is optional in this minimal form); firstName/lastName are
      // still stored structurally server-side.
      if (type === "individual") { cf.set("firstName", firstName); cf.set("lastName", lastName); cf.set("fullName", [firstName.trim(), lastName.trim()].filter(Boolean).join(" ")) }
      else { cf.set("companyName", companyName) }
      cf.set("phone", phone)
      const res = await fetch("/api/customers", { method: "POST", body: cf })
      const data = await res.json() as { success?: boolean; id?: string; error?: string; existingCustomer?: { id: string; label: string } }
      if (data?.existingCustomer) { setDuplicate(data.existingCustomer); setError(data.error || ""); setBusy(false); return }
      if (!data?.success || !data.id) { setError(data?.error || "Müşteri oluşturulamadı"); setBusy(false); return }
      const label = type === "corporate" ? companyName.trim() : [firstName.trim(), lastName.trim()].filter(Boolean).join(" ")
      setBusy(false)
      onSelected(data.id, label)
    } catch {
      setError("Bir hata oluştu"); setBusy(false)
    }
  }

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant={type === "individual" ? "default" : "outline"} className="flex-1" onClick={() => setType("individual")}>Bireysel</Button>
          <Button type="button" size="sm" variant={type === "corporate" ? "default" : "outline"} className="flex-1" onClick={() => setType("corporate")}>Kurumsal</Button>
        </div>
        {type === "individual" ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Ad *</Label><Input autoFocus value={firstName} onChange={(e) => setFirstName(toTrUpper(e.target.value))} /></div>
            <div className="space-y-1"><Label>Soyad</Label><Input value={lastName} onChange={(e) => setLastName(toTrUpper(e.target.value))} /></div>
          </div>
        ) : (
          <div className="space-y-1"><Label>Şirket adı *</Label><Input autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
        )}
        <div className="space-y-1"><Label>Telefon *</Label><Input value={phone} onChange={(e) => { setPhone(formatPhoneTR(e.target.value)); setDuplicate(null); setError("") }} inputMode="tel" placeholder="0544 515 74 08" /></div>
        {duplicate ? (
          <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
            <p className="text-sm text-foreground">Bu telefon <span className="font-medium">{duplicate.label}</span> adlı müşteriye ait.</p>
            <Button type="button" size="sm" className="w-full" onClick={() => onSelected(duplicate.id, duplicate.label)}><User className="size-4 mr-1" /> Bu müşteriyi seç</Button>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setError("") }}>Vazgeç</Button>
          <Button type="button" size="sm" onClick={handleCreate} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : "Müşteriyi oluştur"}</Button>
        </div>
      </div>
    )
  }

  return (
    <Combobox
      items={results}
      filter={() => true}
      itemToStringValue={(r: CustomerHit) => r.label}
      onInputValueChange={(v: string) => setQuery(v)}
      onValueChange={(r: CustomerHit | null) => { if (r) onSelected(r.customerId, r.label) }}
    >
      <ComboboxInput autoFocus={autoFocus} placeholder="Müşteri adı veya telefon ile ara…" />
      <ComboboxContent>
        <ComboboxEmpty className="p-0">
          {loading ? (
            <span className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Aranıyor…</span>
          ) : query.trim().length >= 1 ? (
            <div className="flex w-full items-center gap-2 p-2">
              <span className="text-xs text-muted-foreground">«{query.trim()}» yok —</span>
              <Button type="button" size="sm" onClick={openCreate}><Plus className="size-4 mr-1" /> Yeni müşteri</Button>
            </div>
          ) : (
            <span className="py-2 text-sm text-muted-foreground">Aramak için yazın</span>
          )}
        </ComboboxEmpty>
        <ComboboxList>
          {(r: CustomerHit) => (
            <ComboboxItem key={r.customerId} value={r}>
              <Item size="sm" className="w-full p-0">
                <ItemMedia><User className="size-4 text-muted-foreground" /></ItemMedia>
                <ItemContent className="gap-0.5"><ItemTitle>{r.label}</ItemTitle><ItemDescription>{r.sublabel}</ItemDescription></ItemContent>
              </Item>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
