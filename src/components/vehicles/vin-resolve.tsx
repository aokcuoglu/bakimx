"use client"

import { useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { Loader2, ScanLine, Check, BadgeCheck, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { isValidVin, MOCK_VIN_PROVIDER, type RuhsatHints, type VinCandidate, type VinResolution } from "@/lib/vin/types"

export type { VinCandidate }

export type VinResolveState = {
  loading: boolean
  error: string
  notice: string
  candidates: VinCandidate[]
  /** API returned 403 feature_locked → show the upgrade upsell instead of a raw error. */
  locked: boolean
  /**
   * The demo (mock) provider answered "not_found" — i.e. VIN_PROVIDER is not
   * configured in this environment, so EVERY real VIN misses. Not a catalog miss;
   * consumers must say so instead of "araç bulunamadı" (#179).
   */
  unconfigured: boolean
}

export const VIN_RESOLVE_IDLE: VinResolveState = {
  loading: false, error: "", notice: "", candidates: [], locked: false, unconfigured: false,
}

export const VIN_NOT_FOUND_NOTICE = "VIN katalogda bulunamadı — marka ve modeli manuel seçin."
export const VIN_UNCONFIGURED_NOTICE =
  "VIN sorgulama servisi bu ortamda yapılandırılmamış (demo modu) — şase sorgusu çalışmıyor, " +
  "marka ve modeli manuel seçin."

export interface VinResolveCallbacks {
  /** A brand-only or brand+model TecDoc hit. Always followed by onCandidate when a single engine variant auto-selects. */
  onBrand?: (brand: { id: number; name: string }) => void
  onModel?: (model: { id: number; name: string }) => void
  /** The auto-selected candidate (status "resolved") or a manually-picked one from VinCandidateList. */
  onCandidate: (candidate: VinCandidate) => void
}

/**
 * Calls /api/vin/resolve and interprets the response into UI state, firing the
 * given callbacks as a side effect. Pure aside from fetch + callbacks, so it's
 * directly testable without rendering — the two consumers (react-hook-form vs.
 * plain useState) each supply callbacks that write into their own field state.
 */
export async function performVinResolve(
  vin: string,
  hints: RuhsatHints,
  callbacks: VinResolveCallbacks
): Promise<VinResolveState> {
  try {
    const res = await fetch("/api/vin/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vin, hints }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (res.status === 403 && data.code === "feature_locked") {
        return { ...VIN_RESOLVE_IDLE, locked: true }
      }
      return { ...VIN_RESOLVE_IDLE, error: data.error || "VIN sorgulanamadı." }
    }
    const result = data as VinResolution
    if (result.status === "not_found") {
      // Mock provider → the miss says nothing about the catalog; it means the
      // lookup never happened. Report the configuration gap, not a fake "yok".
      if (result.provider === MOCK_VIN_PROVIDER) {
        return { ...VIN_RESOLVE_IDLE, notice: VIN_UNCONFIGURED_NOTICE, unconfigured: true }
      }
      return { ...VIN_RESOLVE_IDLE, notice: VIN_NOT_FOUND_NOTICE }
    }
    if (result.brand) callbacks.onBrand?.(result.brand)
    if (result.model) callbacks.onModel?.(result.model)
    const autoCandidate =
      result.status === "resolved" && result.autoSelected != null
        ? result.candidates.find((c) => c.vehicleTypeId === result.autoSelected)
        : undefined
    if (autoCandidate) {
      callbacks.onCandidate(autoCandidate)
      return {
        ...VIN_RESOLVE_IDLE,
        notice: `Araç katalogdan tanındı: ${autoCandidate.brandName} ${autoCandidate.modelName} ${autoCandidate.name}`,
      }
    }
    if (result.status === "resolved") {
      return {
        ...VIN_RESOLVE_IDLE,
        notice: `Araç katalogdan tanındı: ${[result.brand?.name, result.model?.name].filter(Boolean).join(" ")}`,
      }
    }
    return { ...VIN_RESOLVE_IDLE, candidates: result.candidates }
  } catch {
    return { ...VIN_RESOLVE_IDLE, error: "VIN sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin." }
  }
}

/** React state wrapper around performVinResolve — see that function for the interpretation rules. */
export function useVinResolve(callbacks: VinResolveCallbacks) {
  const [state, setState] = useState<VinResolveState>(VIN_RESOLVE_IDLE)

  async function resolve(vin: string, hints: RuhsatHints) {
    if (!isValidVin(vin)) return
    setState({ ...VIN_RESOLVE_IDLE, loading: true })
    const next = await performVinResolve(vin, hints, callbacks)
    setState(next)
  }

  function applyCandidate(c: VinCandidate) {
    callbacks.onCandidate(c)
    setState({ ...VIN_RESOLVE_IDLE, notice: `Araç katalogdan tanındı: ${c.brandName} ${c.modelName} ${c.name}` })
  }

  return { ...state, resolve, applyCandidate, reset: () => setState(VIN_RESOLVE_IDLE) }
}

/** "VIN'den getir" — manual trigger next to the VIN input. */
export function VinResolveButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className="gap-2 shrink-0"
      title="Şase numarasından marka, model ve motor bilgilerini getir"
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
      VIN&apos;den getir
    </Button>
  )
}

/**
 * Shown when /api/vin/resolve returns 403 feature_locked — VIN'den araç tanıma
 * is a Pro+ capability. Compact inline upsell (mobile-first) reused by every
 * VinResolveButton consumer so the message is consistent everywhere.
 */
export function VinLockedNotice() {
  return (
    <div className="rounded-md border border-border bg-muted/40 p-2.5 space-y-2 text-sm">
      <p className="flex items-start gap-1.5 text-muted-foreground">
        <Lock className="size-3.5 mt-0.5 shrink-0" />
        <span>VIN&apos;den otomatik araç tanıma Pro ve üzeri paketlere özeldir.</span>
      </p>
      <Link href="/checkout?tier=pro&cycle=monthly" className={cn(buttonVariants({ size: "sm" }), "w-full")}>
        Pro&apos;ya yükselt
      </Link>
    </div>
  )
}

/**
 * The resolver's textual outcome. A normal miss stays quiet muted text; an
 * unconfigured provider gets a warning box, because "servis kapalı" is an
 * actionable operations fact, not a fact about the customer's vehicle (#179).
 */
export function VinResolveNotice({ notice, unconfigured }: { notice: string; unconfigured: boolean }) {
  if (!notice) return null
  if (!unconfigured) return <p className="text-sm text-muted-foreground">{notice}</p>
  return (
    <Alert variant="warning">
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  )
}

/**
 * Engine-variant picker shown when the VIN maps to several catalog types and
 * the ruhsat hints can't pick a confident winner. Mobile-first tappable rows.
 */
export function VinCandidateList({
  candidates,
  selectedId,
  onSelect,
  onDismiss,
}: {
  candidates: VinCandidate[]
  selectedId: number | null
  onSelect: (candidate: VinCandidate) => void
  onDismiss: () => void
}) {
  if (candidates.length === 0) return null
  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 space-y-1">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-xs font-medium text-muted-foreground">
          Katalogda {candidates.length} motor varyantı bulundu — aracınıza uyanı seçin
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Vazgeç
        </button>
      </div>
      {candidates.map((c, i) => {
        const selected = selectedId === c.vehicleTypeId
        return (
          <button
            key={c.vehicleTypeId}
            type="button"
            onClick={() => onSelect(c)}
            className={cn(
              "w-full min-h-8 flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              selected
                ? "border-primary bg-primary/5 text-foreground"
                : "border-transparent bg-background hover:border-border"
            )}
          >
            <span className={cn("size-4 shrink-0", selected ? "text-primary" : "text-transparent")}>
              <Check className="size-4" />
            </span>
            <span className="flex-1">{c.label}</span>
            {i === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium px-2 py-0.5 shrink-0">
                <BadgeCheck className="size-3" />
                En uygun
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
