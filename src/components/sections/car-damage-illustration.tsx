// Top-view 2D car silhouette with damage markers positioned on the body.
// Marker color classes are written as literal strings so Tailwind keeps them.

const markers = [
  { cx: 50, cy: 52, ring: "fill-destructive/20", dot: "fill-destructive" },
  { cx: 97, cy: 150, ring: "fill-warning/25", dot: "fill-warning" },
  { cx: 52, cy: 244, ring: "fill-brand/25", dot: "fill-brand" },
];

export function CarDamageIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 140 300"
      className={className}
      role="img"
      aria-label="2D araç hasar haritası"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* wheels */}
      <g className="fill-foreground/55">
        <rect x="16" y="62" width="13" height="34" rx="6" />
        <rect x="111" y="62" width="13" height="34" rx="6" />
        <rect x="16" y="206" width="13" height="34" rx="6" />
        <rect x="111" y="206" width="13" height="34" rx="6" />
      </g>

      {/* side mirrors */}
      <g className="fill-card stroke-foreground/20" strokeWidth="1.5">
        <rect x="17" y="104" width="11" height="9" rx="3" />
        <rect x="112" y="104" width="11" height="9" rx="3" />
      </g>

      {/* body */}
      <rect
        x="25"
        y="14"
        width="90"
        height="272"
        rx="42"
        className="fill-card stroke-foreground/15"
        strokeWidth="2.5"
      />

      {/* hood / trunk seams */}
      <path d="M40 84 H100" className="stroke-foreground/10" strokeWidth="1.5" fill="none" />
      <path d="M40 200 H100" className="stroke-foreground/10" strokeWidth="1.5" fill="none" />

      {/* windshield */}
      <path d="M47 64 H93 L100 84 H40 Z" className="fill-primary/15" />
      {/* roof / cabin */}
      <rect x="40" y="86" width="60" height="112" rx="12" className="fill-primary/10" />
      {/* rear window */}
      <path d="M40 200 H100 L93 220 H47 Z" className="fill-primary/15" />
      {/* center seam */}
      <line x1="70" y1="20" x2="70" y2="60" className="stroke-foreground/10" strokeWidth="1.5" />

      {/* damage markers */}
      {markers.map((m) => (
        <g key={`${m.cx}-${m.cy}`}>
          <circle cx={m.cx} cy={m.cy} r="12" className={`${m.ring} motion-safe:animate-pulse`} />
          <circle
            cx={m.cx}
            cy={m.cy}
            r="6"
            className={`${m.dot} stroke-card`}
            strokeWidth="2"
          />
        </g>
      ))}
    </svg>
  );
}
