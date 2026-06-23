"use client"

import { useState } from "react"
import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { AlertTriangle, Info, Car } from "lucide-react"

type DamageMark = {
  id: string
  zone: string
  damageType: string
  severity: string
  note: string | null
}

type VehicleDamageMapProps = {
  damageMarks: DamageMark[]
  onZoneClick: (zone: string) => void
  onRemoveMark?: (markId: string) => void
  vehicle?: {
    plate: string
    brand: string
    model: string
  } | null
}

const SEVERITY = DAMAGE_SEVERITY as Record<string, { label: string; color: string }>
const TYPES = DAMAGE_TYPES as Record<string, { label: string; color: string }>

function severityColor(severity: string): string {
  return SEVERITY[severity]?.color || "#9CA3AF"
}

function severityLabel(severity: string): string {
  return SEVERITY[severity]?.label || severity
}

function typeStyle(type: string) {
  return TYPES[type] || { label: type, color: "#6B7280" }
}

const ZONE_GROUPS = [
  { label: "Ön", zones: ["front_bumper", "hood", "left_headlight", "right_headlight", "left_front_fender", "right_front_fender"] },
  { label: "İç", zones: ["windshield", "roof", "rear_window", "left_front_door", "right_front_door", "left_rear_door", "right_rear_door"] },
  { label: "Arka", zones: ["trunk", "rear_bumper", "left_taillight", "right_taillight", "left_rear_fender", "right_rear_fender"] },
]

export function VehicleDamageMap({ damageMarks, onZoneClick, onRemoveMark, vehicle }: VehicleDamageMapProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  function marksIn(zone: string) {
    return damageMarks.filter((m) => m.zone === zone)
  }

  function isDamaged(zone: string) {
    return marksIn(zone).length > 0
  }

  const severitySummary = { light: 0, medium: 0, heavy: 0 }
  damageMarks.forEach((m) => { if (m.severity in severitySummary) severitySummary[m.severity as keyof typeof severitySummary]++ })

  return (
    <div className="space-y-5">
      {/* Vehicle badge */}
      {vehicle && (
        <div className="flex items-center gap-3 bg-card border rounded-xl p-3">
          <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Car className="size-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{vehicle.plate}</div>
            <div className="text-xs text-muted-foreground truncate">{vehicle.brand} {vehicle.model}</div>
          </div>
        </div>
      )}

      {/* Hints */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2.5 rounded-lg border">
        <Info className="size-3.5 shrink-0 text-primary" />
        <span>Hasar eklemek için araç şemasında bir bölgeye tıklayın</span>
      </div>

      {/* Severity summary */}
      {damageMarks.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {Object.entries(SEVERITY).map(([k, v]) => {
            const c = severitySummary[k as keyof typeof severitySummary]
            if (c === 0) return null
            return (
              <div key={k} className="flex items-center gap-1.5 text-[11px] font-medium bg-card border rounded-full px-2.5 py-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: v.color }} />
                {v.label} <span className="text-muted-foreground font-normal">{c}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* === SVG === */}
      <div className="bg-gradient-to-b from-muted/20 to-muted/5 rounded-2xl border p-4 sm:p-6 overflow-x-auto relative">
        <svg
          viewBox="0 0 400 580"
          className="w-full max-w-sm mx-auto select-none"
          style={{ minWidth: "260px", touchAction: "manipulation" }}
        >
          <defs>
            <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" /></filter>
            <filter id="glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="200" cy="540" rx="160" ry="10" fill="rgba(0,0,0,0.04)" />

          {/* === Car body outline === */}
          <g filter="url(#shadow)">
            <path
              d="M 200,60 C 255,60 295,68 320,82 C 338,92 348,105 352,118 L 358,220 C 362,232 362,268 358,280 L 354,360 C 362,372 362,408 358,420 L 350,478 C 342,502 325,518 295,524 C 260,530 230,530 200,530 C 170,530 140,530 105,524 C 75,518 58,502 50,478 L 42,420 C 38,408 38,372 46,360 L 42,280 C 38,268 38,232 42,220 L 48,118 C 52,105 62,92 80,82 C 105,68 145,60 200,60 Z"
              fill="rgba(100,116,139,0.04)"
              stroke="currentColor"
              strokeWidth="1"
              className="text-border"
            />
          </g>

          {/* === Panel lines === */}
          <g stroke="currentColor" strokeWidth="0.5" className="text-border/40" fill="none">
            {/* Front bumper line */}
            <path d="M 88,108 Q 200,100 312,108" />
            {/* Hood line */}
            <line x1="88" y1="155" x2="312" y2="155" />
            {/* Windshield bottom */}
            <line x1="108" y1="198" x2="292" y2="198" />
            {/* Roof rear */}
            <line x1="118" y1="265" x2="282" y2="265" />
            {/* Rear window bottom */}
            <line x1="98" y1="305" x2="302" y2="305" />
            {/* Trunk line */}
            <line x1="90" y1="355" x2="310" y2="355" />
            {/* Rear bumper */}
            <path d="M 95,395 Q 200,408 305,395" />

            {/* Left door lines */}
            <line x1="55" y1="250" x2="80" y2="260" />
            <line x1="50" y1="330" x2="82" y2="340" />
            <line x1="50" y1="420" x2="82" y2="420" />

            {/* Right door lines */}
            <line x1="345" y1="250" x2="320" y2="260" />
            <line x1="350" y1="330" x2="318" y2="340" />
            <line x1="350" y1="420" x2="318" y2="420" />

            {/* Hood center */}
            <line x1="200" y1="108" x2="200" y2="155" strokeDasharray="2,3" />
          </g>

          {/* === Wheels === */}
          <g>
            {/* Front left */}
            <rect x="38" y="225" width="14" height="36" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="0.5" />
            {/* Rear left */}
            <rect x="38" y="410" width="14" height="36" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="0.5" />
            {/* Front right */}
            <rect x="348" y="225" width="14" height="36" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="0.5" />
            {/* Rear right */}
            <rect x="348" y="410" width="14" height="36" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="0.5" />
          </g>

          {/* === Zone overlays === */}
          {ZONES.map((zone) => {
            const marks = marksIn(zone.id)
            const damaged = marks.length > 0
            const active = hovered === zone.id

            return (
              <g
                key={zone.id}
                onClick={() => onZoneClick(zone.id)}
                onMouseEnter={() => setHovered(zone.id)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer outline-none"
                role="button"
                tabIndex={0}
                aria-label={VEHICLE_ZONES[zone.id as keyof typeof VEHICLE_ZONES] || zone.id}
              >
                {/* Zone shape */}
                <path
                  d={zone.path}
                  fill={
                    damaged
                      ? active ? "rgba(239,68,68,0.3)" : "rgba(239,68,68,0.15)"
                      : active ? "rgba(59,130,246,0.08)" : "transparent"
                  }
                  stroke={
                    damaged
                      ? active ? "rgba(239,68,68,0.7)" : "rgba(239,68,68,0.35)"
                      : active ? "rgba(59,130,246,0.35)" : "transparent"
                  }
                  strokeWidth={active || damaged ? 1.2 : 0}
                  strokeLinejoin="round"
                  className="transition-all duration-150"
                />

                {/* Hover label */}
                {active && !damaged && (
                  <text
                    x={zone.lx} y={zone.ly}
                    textAnchor="middle" dominantBaseline="middle"
                    fill="currentColor" fontSize="7" fontWeight="500"
                    className="text-muted-foreground/60"
                    style={{ pointerEvents: "none" }}
                  >
                    {VEHICLE_ZONES[zone.id as keyof typeof VEHICLE_ZONES] || zone.id}
                  </text>
                )}

                {/* Damage count badge */}
                {damaged && (
                  <>
                    {/* Glow ring */}
                    <circle cx={zone.dx} cy={zone.dy} r={active ? 14 : 11} fill="none" stroke={severityColor(marks[0].severity)} strokeWidth={active ? 1.5 : 0.75} opacity={active ? 0.5 : 0.3} className="transition-all duration-200" />
                    {/* Dot */}
                    <circle cx={zone.dx} cy={zone.dy} r={active ? 9 : 7} fill={severityColor(marks[0].severity)} stroke="white" strokeWidth="2" filter={active ? "url(#glow)" : undefined} className="transition-all duration-200" />
                    {/* Number */}
                    <text
                      x={zone.dx} y={zone.dy + 0.5}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="white" fontSize="8" fontWeight="bold"
                      style={{ pointerEvents: "none" }}
                    >
                      {marks.length}
                    </text>
                  </>
                )}
              </g>
            )
          })}

          {/* === Tooltip === */}
          {hovered && (() => {
            const z = ZONES.find((x) => x.id === hovered)
            if (!z) return null
            const marks = marksIn(hovered)
            const name = VEHICLE_ZONES[hovered as keyof typeof VEHICLE_ZONES] || hovered
            return (
              <g style={{ pointerEvents: "none" }}>
                <rect x={z.dx - 46} y={z.dy - (marks.length > 0 ? 50 : 40)} width="92" height={marks.length > 0 ? 38 : 28} rx="5" fill="rgba(30,41,59,0.92)" />
                <text x={z.dx} y={z.dy - (marks.length > 0 ? 34 : 24)} textAnchor="middle" fill="white" fontSize="8.5" fontWeight="600">{name}</text>
                {marks.length > 0 && (
                  <>
                    <text x={z.dx} y={z.dy - 20} textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="7.5">{marks.length} hasar · {severityLabel(marks[0].severity)}</text>
                    <circle cx={z.dx - 20} cy={z.dy - 20} r="3" fill={severityColor(marks[0].severity)} />
                  </>
                )}
              </g>
            )
          })()}
        </svg>
      </div>

      {/* Zone group quick-nav */}
      <div className="grid grid-cols-3 gap-2">
        {ZONE_GROUPS.map((g) => {
          const count = g.zones.reduce((s, z) => s + marksIn(z).length, 0)
          const firstFree = g.zones.find((z) => !isDamaged(z))
          return (
            <button
              key={g.label}
              onClick={() => firstFree && onZoneClick(firstFree)}
              className={`text-left p-3 min-h-12 rounded-xl border transition-all touch-manipulation active:scale-[0.98] ${
                count > 0 ? "bg-destructive/5 border-destructive/15" : "bg-card border-border hover:border-primary/30"
              }`}
            >
              <div className="text-xs font-medium">{g.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {count > 0 ? `${count} hasar` : "Temiz"}
              </div>
            </button>
          )
        })}
      </div>

      {/* Damage type legend */}
      <div className="bg-card border rounded-xl p-3.5">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 flex items-center gap-2">
          <AlertTriangle className="size-3 text-destructive" />
          Hasar Tipleri
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {Object.entries(TYPES).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/30">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: v.color }} />
              <span className="text-[11px] text-muted-foreground">{v.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Damage list */}
      {damageMarks.length > 0 && (
        <div className="bg-card border rounded-xl p-3.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5 flex items-center gap-2">
            <AlertTriangle className="size-3 text-destructive" />
            Kayıtlar ({damageMarks.length})
          </h4>
          <div className="space-y-0.5 max-h-60 overflow-y-auto pr-1">
            {damageMarks.map((m) => (
              <div key={m.id} className="group flex items-center justify-between py-1.5 px-2 rounded-md text-[11px] hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: severityColor(m.severity) }} />
                  <span className="font-medium truncate">{VEHICLE_ZONES[m.zone as keyof typeof VEHICLE_ZONES] || m.zone}</span>
                  <span className="text-[10px] px-1 rounded text-white font-medium shrink-0" style={{ backgroundColor: typeStyle(m.damageType).color }}>{typeStyle(m.damageType).label}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">({severityLabel(m.severity)})</span>
                  {m.note && <span className="text-muted-foreground truncate hidden sm:inline">— {m.note}</span>}
                </div>
                {onRemoveMark && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveMark(m.id) }}
                    aria-label="Hasarı kaldır"
                    className="inline-flex size-9 items-center justify-center rounded-md text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0 ml-1 opacity-100 touch-manipulation sm:size-7 sm:opacity-0 sm:group-hover:opacity-100"
                    title="Kaldır"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const ZONES = [
  {
    id: "front_bumper",
    path: "M 100,62 Q 200,52 300,62 L 312,108 L 88,108 Z",
    dx: 200, dy: 82, lx: 200, ly: 85,
  },
  {
    id: "hood",
    path: "M 88,108 L 312,108 L 310,155 L 90,155 Z",
    dx: 200, dy: 132, lx: 200, ly: 135,
  },
  {
    id: "windshield",
    path: "M 108,155 L 292,155 L 280,198 L 120,198 Z",
    dx: 200, dy: 177, lx: 200, ly: 180,
  },
  {
    id: "roof",
    path: "M 120,198 L 280,198 L 278,265 L 122,265 Z",
    dx: 200, dy: 232, lx: 200, ly: 235,
  },
  {
    id: "rear_window",
    path: "M 122,265 L 278,265 L 290,305 L 110,305 Z",
    dx: 200, dy: 285, lx: 200, ly: 288,
  },
  {
    id: "trunk",
    path: "M 95,305 L 305,305 L 310,355 L 90,355 Z",
    dx: 200, dy: 330, lx: 200, ly: 333,
  },
  {
    id: "rear_bumper",
    path: "M 95,355 L 305,355 L 295,395 Q 200,410 105,395 Z",
    dx: 200, dy: 378, lx: 200, ly: 381,
  },
  {
    id: "left_front_fender",
    path: "M 48,82 L 88,108 L 82,260 L 58,245 Z",
    dx: 66, dy: 172, lx: 62, ly: 175,
  },
  {
    id: "left_front_door",
    path: "M 58,245 L 82,260 L 82,338 L 54,328 Z",
    dx: 66, dy: 296, lx: 62, ly: 299,
  },
  {
    id: "left_rear_door",
    path: "M 54,328 L 82,338 L 82,420 L 52,412 Z",
    dx: 66, dy: 378, lx: 62, ly: 381,
  },
  {
    id: "left_rear_fender",
    path: "M 52,412 L 82,420 L 78,524 L 50,500 Z",
    dx: 64, dy: 468, lx: 62, ly: 471,
  },
  {
    id: "right_front_fender",
    path: "M 352,82 L 312,108 L 318,260 L 342,245 Z",
    dx: 334, dy: 172, lx: 338, ly: 175,
  },
  {
    id: "right_front_door",
    path: "M 342,245 L 318,260 L 318,338 L 346,328 Z",
    dx: 334, dy: 296, lx: 338, ly: 299,
  },
  {
    id: "right_rear_door",
    path: "M 346,328 L 318,338 L 318,420 L 348,412 Z",
    dx: 334, dy: 378, lx: 338, ly: 381,
  },
  {
    id: "right_rear_fender",
    path: "M 348,412 L 318,420 L 322,524 L 350,500 Z",
    dx: 336, dy: 468, lx: 338, ly: 471,
  },
  {
    id: "left_headlight",
    path: "M 100,62 Q 82,68 62,78 L 55,92 L 88,108 Z",
    dx: 72, dy: 82, lx: 70, ly: 85,
  },
  {
    id: "right_headlight",
    path: "M 300,62 Q 318,68 338,78 L 345,92 L 312,108 Z",
    dx: 328, dy: 82, lx: 330, ly: 85,
  },
  {
    id: "left_taillight",
    path: "M 55,490 L 78,524 L 82,420 L 55,420 Z",
    dx: 66, dy: 462, lx: 64, ly: 465,
  },
  {
    id: "right_taillight",
    path: "M 345,490 L 322,524 L 318,420 L 345,420 Z",
    dx: 334, dy: 462, lx: 336, ly: 465,
  },
  {
    id: "wheels",
    path: "M 38,225 L 52,225 L 52,261 L 38,261 Z M 38,410 L 52,410 L 52,446 L 38,446 Z M 348,225 L 362,225 L 362,261 L 348,261 Z M 348,410 L 362,410 L 362,446 L 348,446 Z",
    dx: 200, dy: 530, lx: 200, ly: 533,
  },
]
