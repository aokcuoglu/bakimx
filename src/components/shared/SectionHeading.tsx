import { BrandEyebrow } from "@/components/shared/brand-decor";

interface SectionHeadingProps {
  /** Mono uppercase eyebrow etiketi — markanın "veri sesi" (bkz. brand-decor). */
  badge?: string;
  title: string;
  titleHighlight?: string;
  subtitle?: string;
  className?: string;
  align?: "center" | "left";
}

/**
 * Landing bölüm başlıklarının tek kaynağı: mono eyebrow + tek ölçekli H2 +
 * alt metin. Bölümler kendi başlıklarını elle yazmaz; aksi halde iki farklı
 * rozet dili ve iki H2 ölçeği bir arada yaşıyordu (UI denetimi §2.2–2.3).
 */
export function SectionHeading({
  badge,
  title,
  titleHighlight,
  subtitle,
  className = "",
  align = "center",
}: SectionHeadingProps) {
  const alignment = align === "left" ? "text-left" : "text-center";
  const maxW = align === "left" ? "max-w-2xl" : "max-w-3xl mx-auto";

  return (
    <div className={`${alignment} ${maxW} ${className}`}>
      {badge && <BrandEyebrow>{badge}</BrandEyebrow>}
      <h2
        className={`text-2xl font-bold tracking-tight text-balance sm:text-3xl lg:text-4xl ${
          badge ? "mt-3" : ""
        }`}
      >
        {titleHighlight ? (
          <>
            {title} <span className="text-primary">{titleHighlight}</span>
          </>
        ) : (
          title
        )}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
          {subtitle}
        </p>
      )}
    </div>
  );
}
