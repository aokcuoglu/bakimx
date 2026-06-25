import Link from "next/link"
import { Check } from "lucide-react"
import { BrandLogo } from "@/components/shared/brand-logo"
import { getPlanPackage } from "@/lib/plans-catalog"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"

type Cycle = "monthly" | "yearly"
type Mode = "public" | "inapp"

/**
 * Sihirbazın koyu lacivert marka raylı sol paneli (mobilde formun üstünde kompakt
 * banner). Form state tüketmez — yalnızca seçili paket/dönem/adımı yansıtır.
 * `value-panel.tsx`'in (açık tema) yerini alır.
 */
export function BrandRail({
  mode,
  tier,
  cycle,
  step,
}: {
  mode: Mode
  tier: PlanTier
  cycle: Cycle
  step: number
}) {
  const pkg = getPlanPackage(tier)
  // pkg her zaman katalogda var (kapalı PlanTier union); yine de fiyat aramasını
  // koruyalım ki gelecekte katalogsuz bir tier eklenirse render çökmesin.
  const amount = formatMinor(pkg ? getPlanPriceMinor(tier, cycle) : 0)
  const isSummary = step === 2

  return (
    <aside className="relative isolate flex flex-col overflow-hidden bg-navy text-navy-foreground">
      {/* derinlik için yumuşak gradient + ışık */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-navy via-navy to-navy-light" />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/25 blur-3xl" />

      <div className="relative flex h-full flex-col p-5 md:p-8">
        <Link
          href="/"
          aria-label="BakimX ana sayfa"
          className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-navy"
        >
          <BrandLogo variant="primary-dark" size="lg" alt="BakimX" />
        </Link>

        {/* başlık — yalnız md+ */}
        <div className="mt-8 hidden md:block">
          <h2 className="text-xl font-bold leading-snug">Birkaç adımda BakimX&apos;e geçin</h2>
          <p className="mt-1.5 text-sm text-white/60">
            Oto servisiniz için dijital araç kabul ve müşteri onay platformu.
          </p>
        </div>

        {/* seçili paket / sipariş özeti kartı — her zaman görünür */}
        <div className="mt-6 rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-sm md:mt-8">
          {isSummary ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Sipariş özeti</p>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Paket" value={pkg?.name ?? tier} />
                <Row label="Dönem" value={cycle === "monthly" ? "Aylık" : "Yıllık (2 ay bedava)"} />
                <Row label="Kullanıcı" value={`${pkg?.seats ?? "—"} kullanıcı`} />
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3">
                <span className="text-sm text-white/60">Toplam · KDV dahil</span>
                <span className="text-2xl font-extrabold">{amount}</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Seçilen paket</p>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-lg font-extrabold">{pkg?.name ?? tier}</span>
                <span className="whitespace-nowrap text-lg font-extrabold">
                  {amount}
                  <span className="text-[11px] font-medium text-white/50">{cycle === "monthly" ? "/ay" : "/yıl"}</span>
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/50">{pkg?.seats ?? "—"} kullanıcı · KDV dahil</p>
            </>
          )}
        </div>

        {/* faydalar — yalnız md+ ve özet adımı dışında */}
        {!isSummary && (
          <ul className="mt-6 hidden space-y-3 text-sm md:block">
            {(pkg?.highlights ?? []).slice(0, 4).map((h) => (
              <li key={h} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-white/85">{h}</span>
              </li>
            ))}
          </ul>
        )}

        {/* güven rozetleri + yasal — alta sabit, yalnız md+ */}
        <div className="mt-auto hidden pt-8 md:block">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-white/55">
            <span>↩︎ İstediğin an iptal</span>
            <span>🔒 Verilerin güvende</span>
            <span>🇹🇷 Türkiye&apos;deki servisler için</span>
          </div>
          {mode === "public" && (
            <div className="mt-4 flex gap-4 border-t border-white/10 pt-4 text-[11px] text-white/40">
              <Link href="/privacy" target="_blank" className="transition-colors hover:text-white/70">
                Gizlilik Politikası
              </Link>
              <Link href="/terms" target="_blank" className="transition-colors hover:text-white/70">
                Kullanım Koşulları
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/55">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}
