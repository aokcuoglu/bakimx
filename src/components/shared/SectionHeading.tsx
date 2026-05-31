interface SectionHeadingProps {
  badge?: string;
  title: string;
  titleHighlight?: string;
  subtitle?: string;
  className?: string;
  align?: "center" | "left";
}

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
      {badge && (
        <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
          {badge}
        </div>
      )}
      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
        {titleHighlight ? (
          <>
            {title} <span className="text-primary">{titleHighlight}</span>
          </>
        ) : (
          title
        )}
      </h2>
      {subtitle && (
        <p className="mt-4 text-muted-foreground text-base sm:text-lg leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}