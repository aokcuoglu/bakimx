import { getPlanPackage } from "@/lib/plans-catalog"
import { getPlanPriceMinor, formatMinor } from "@/lib/billing/pricing"
import type { PlanTier } from "@/lib/plan"

type Cycle = "monthly" | "yearly"

/** Sihirbazın sağ paneli (mobilde formun üstünde). Form state tüketmez. */
export function ValuePanel({
  tier,
  cycle,
  step,
}: {
  tier: PlanTier
  cycle: Cycle
  step: number
}) {
  const pkg = getPlanPackage(tier)
  const amount = formatMinor(getPlanPriceMinor(tier, cycle))
  const isSummary = step === 2

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-5">
      {isSummary ? (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Sipariş özeti</p>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Paket" value={pkg?.name ?? tier} />
            <Row label="Dönem" value={cycle === "monthly" ? "Aylık" : "Yıllık"} />
            <Row label="Kullanıcı" value={String(pkg?.seats ?? "—")} />
          </div>
          <div className="mt-3 flex items-baseline justify-between border-t border-primary/15 pt-3">
            <span className="text-sm text-muted-foreground">Toplam (KDV dahil)</span>
            <span className="text-xl font-extrabold text-foreground">{amount}</span>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-lg border border-primary/20 bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Seçilen paket</p>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-base font-extrabold text-foreground">{pkg?.name ?? tier}</span>
              <span className="text-base font-extrabold text-foreground">
                {amount}
                <span className="text-[11px] font-medium text-muted-foreground">{cycle === "monthly" ? "/ay" : "/yıl"}</span>
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{pkg?.seats ?? "—"} kullanıcı · KDV dahil</p>
          </div>

          {/* faydalar + illüstrasyon yalnız md+ (mobilde kompakt kalsın) */}
          <div className="hidden md:block">
            <div className="my-4 flex justify-center"><CarIllustration /></div>
            <p className="mb-2 text-xs font-bold text-foreground">Bu pakette kazandıkların</p>
            <ul className="space-y-2 text-xs text-foreground">
              {(pkg?.highlights ?? []).slice(0, 4).map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="font-bold text-emerald-600">✓</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <div className="mt-4 hidden border-t border-primary/15 pt-3 text-[11px] leading-relaxed text-muted-foreground md:block">
        ↩︎ İstediğin an iptal
        <br />🔒 Verilerin güvende
        <br />🇹🇷 Türkiye&apos;deki servisler için
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  )
}

function CarIllustration() {
  return (
    <svg width="120" height="62" viewBox="0 0 120 62" fill="none" aria-hidden="true">
      <rect x="6" y="40" width="108" height="6" rx="3" className="fill-primary/20" />
      <path d="M18 40c0-7 5-13 12-15l8-10c2-3 5-4 9-4h20c5 0 9 2 12 6l8 11c8 1 15 6 15 14v6H18v-8z" className="fill-primary" />
      <path d="M40 16h18v11H32l8-11z" className="fill-primary/20" />
      <path d="M62 16h16c3 0 6 1 8 4l5 7H62V16z" className="fill-primary/20" />
      <circle cx="36" cy="46" r="9" className="fill-foreground" /><circle cx="36" cy="46" r="4" className="fill-muted" />
      <circle cx="88" cy="46" r="9" className="fill-foreground" /><circle cx="88" cy="46" r="4" className="fill-muted" />
    </svg>
  )
}
