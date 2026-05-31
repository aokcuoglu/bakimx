"use client"

import { DAMAGE_TYPES, DAMAGE_SEVERITY, VEHICLE_ZONES } from "@/lib/constants"
import { AlertTriangle, Info } from "lucide-react"

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
}

const ZONE_PATHS: Record<string, { path: string; cx: number; cy: number }> = {
  front_bumper: { path: "M120,90 L200,70 L280,90 L280,130 L120,130 Z", cx: 200, cy: 110 },
  hood: { path: "M120,130 L280,130 L280,180 L120,180 Z", cx: 200, cy: 155 },
  windshield: { path: "M125,180 L275,180 L260,220 L140,220 Z", cx: 200, cy: 200 },
  roof: { path: "M140,220 L260,220 L260,270 L140,270 Z", cx: 200, cy: 245 },
  left_front_fender: { path: "M60,90 L120,90 L120,270 L80,250 L60,180 Z", cx: 90, cy: 180 },
  left_front_door: { path: "M80,250 L120,270 L120,360 L80,350 Z", cx: 98, cy: 310 },
  left_rear_door: { path: "M80,350 L120,360 L120,430 L80,420 Z", cx: 98, cy: 390 },
  left_rear_fender: { path: "M80,420 L120,430 L120,510 L90,500 L60,480 Z", cx: 88, cy: 460 },
  rear_window: { path: "M140,270 L260,270 L275,300 L125,300 Z", cx: 200, cy: 285 },
  trunk: { path: "M125,300 L275,300 L280,350 L120,350 Z", cx: 200, cy: 325 },
  right_front_fender: { path: "M280,90 L340,90 L340,180 L320,250 L280,270 Z", cx: 310, cy: 180 },
  right_front_door: { path: "M280,270 L320,250 L320,350 L280,360 Z", cx: 302, cy: 310 },
  right_rear_door: { path: "M280,360 L320,350 L320,420 L280,430 Z", cx: 302, cy: 390 },
  right_rear_fender: { path: "M280,430 L320,420 L340,480 L310,500 L280,510 Z", cx: 312, cy: 460 },
  rear_bumper: { path: "M120,510 L280,510 L340,500 L340,540 L60,540 L60,500 Z", cx: 200, cy: 525 },
  left_headlight: { path: "M120,90 L60,90 L60,130 L120,130 Z", cx: 90, cy: 110 },
  right_headlight: { path: "M280,90 L340,90 L340,130 L280,130 Z", cx: 310, cy: 110 },
  left_taillight: { path: "M60,500 L90,500 L120,510 L60,540 Z", cx: 85, cy: 515 },
  right_taillight: { path: "M310,500 L340,500 L340,540 L280,510 Z", cx: 315, cy: 515 },
  wheels: { path: "M60,540 L340,540 L340,570 L60,570 Z", cx: 200, cy: 555 },
}

function getSeverityColor(severity: string): string {
  return (DAMAGE_SEVERITY as Record<string, { color: string }>)[severity]?.color || "#9CA3AF"
}

export function VehicleDamageMap({ damageMarks, onZoneClick, onRemoveMark }: VehicleDamageMapProps) {
  const damagedZones = new Set(damageMarks.map((m) => m.zone))

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 text-blue-800 p-3 rounded-lg">
        <Info className="size-4 shrink-0" />
        <span>Araç üzerinde tıklanabilir bölgelere tıklayarak hasar işaretleyiniz</span>
      </div>

      {/* Vehicle SVG */}
      <div className="bg-muted/30 rounded-xl p-4 overflow-x-auto">
        <svg
          viewBox="0 0 400 590"
          className="w-full max-w-sm mx-auto"
          style={{ minWidth: "280px" }}
        >
          {/* Vehicle body outline */}
          <path
            d="M200,60 C270,60 320,70 340,90 L340,180 L320,500 L340,540 L60,540 L80,500 L60,180 L60,90 C80,70 130,60 200,60"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground/20"
          />

          {/* Zone overlays */}
          {Object.entries(ZONE_PATHS).map(([zone, data]) => {
            const isDamaged = damagedZones.has(zone)
            const marksInZone = damageMarks.filter((m) => m.zone === zone)

            return (
              <g key={zone} onClick={() => onZoneClick(zone)} className="cursor-pointer">
                <path
                  d={data.path}
                  fill={isDamaged ? "rgba(239, 68, 68, 0.25)" : "rgba(37, 99, 235, 0.06)"}
                  stroke={isDamaged ? "rgba(239, 68, 68, 0.7)" : "rgba(37, 99, 235, 0.25)"}
                  strokeWidth={isDamaged ? "2" : "1"}
                  className="transition-colors hover:fill-primary/15"
                />
                {isDamaged && (
                  <>
                    <circle
                      cx={data.cx}
                      cy={data.cy}
                      r="9"
                      fill={getSeverityColor(marksInZone[0]?.severity || "light")}
                      stroke="white"
                      strokeWidth="1.5"
                    />
                    <text
                      x={data.cx}
                      y={data.cy + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="white"
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {marksInZone.length}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Severity Legend */}
      <div className="bg-card border rounded-xl p-4">
        <h4 className="text-sm font-medium mb-3">Hasar Şiddeti</h4>
        <div className="flex flex-wrap gap-4">
          {Object.entries(DAMAGE_SEVERITY).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: val.color }}
              />
              <span className="text-sm">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Damage type legend */}
      <div className="bg-card border rounded-xl p-4">
        <h4 className="text-sm font-medium mb-3">Hasar Tipleri</h4>
        <div className="flex flex-wrap gap-3">
          {Object.entries(DAMAGE_TYPES).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: val.color }} />
              <span className="text-xs text-muted-foreground">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Damage list summary */}
      {damageMarks.length > 0 && (
        <div className="bg-card border rounded-xl p-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            Hasar Kayıtları ({damageMarks.length})
          </h4>
          <div className="space-y-2">
            {damageMarks.map((mark) => (
              <div key={mark.id} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: getSeverityColor(mark.severity) }}
                  />
                  <span className="font-medium truncate">
                    {VEHICLE_ZONES[mark.zone as keyof typeof VEHICLE_ZONES] || mark.zone}
                  </span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {DAMAGE_TYPES[mark.damageType as keyof typeof DAMAGE_TYPES]?.label || mark.damageType}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted shrink-0">
                    {DAMAGE_SEVERITY[mark.severity as keyof typeof DAMAGE_SEVERITY]?.label || mark.severity}
                  </span>
                  {mark.note && (
                    <span className="text-muted-foreground text-xs truncate">- {mark.note}</span>
                  )}
                </div>
                {onRemoveMark && (
                  <button
                    onClick={() => onRemoveMark(mark.id)}
                    className="text-destructive hover:underline text-xs shrink-0 ml-2"
                    title="Hasarı kaldır"
                  >
                    ✕
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
