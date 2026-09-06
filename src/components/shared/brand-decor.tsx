/**
 * Marka görsel dili primitifleri (marka kimliği sistemi v1.0).
 * - BrandEyebrow: mono, uppercase "spec-sheet" etiketi — markanın veri/teknik sesi.
 * - BlueprintGrid: koyu zeminlerde ince ızgara dokusu (atölye/ölçü çağrışımı),
 *   merkeze doğru maskeli, çok düşük opaklık.
 * Bkz. docs/brand/2026-07-22-bakimx-marka-kimligi.md
 */

export function BrandEyebrow({
  children,
  className = "",
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  /** "on-dark": lacivert bantlar (final CTA) için — metin yüzeyin ön planına döner. */
  tone?: "default" | "on-dark";
}) {
  return (
    <span
      className={`font-mono text-xs font-medium uppercase tracking-[0.18em] ${
        tone === "on-dark" ? "text-navy-foreground" : "text-foreground"
      } ${className}`}
    >
      {children}
    </span>
  );
}

export function BlueprintGrid({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 -z-10 opacity-[0.05] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_35%,#000_40%,transparent_100%)] ${className}`}
    />
  );
}
