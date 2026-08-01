/**
 * Küçük KPI kartı — stok ve işçilik listelerinde ortak kullanılır.
 * `parts-list.tsx` ile `labor-list.tsx` aynı görsel dili paylaşsın diye buraya çıkarıldı.
 */
export function KpiStat({ label, value, icon: Icon, accent, accentBg }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{label}</span>
        <div className={`size-7 sm:size-9 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 sm:size-4 ${accent}`} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}
