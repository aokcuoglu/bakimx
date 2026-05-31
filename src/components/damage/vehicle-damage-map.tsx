"use client"

import { DAMAGE_TYPES } from "@/lib/constants"
import { AlertTriangle } from "lucide-react"

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

export function VehicleDamageMap({ damageMarks, onZoneClick }: VehicleDamageMapProps) {
  const damagedZones = new Set(damageMarks.map((m) => m.zone))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="size-4" />
        <span>Araç üzerinde hasarlı bölgelere tıklayarak hasar ekleyin</span>
      </div>

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
                  fill={isDamaged ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.05)"}
                  stroke={isDamaged ? "#EF4444" : "rgba(59, 130, 246, 0.3)"}
                  strokeWidth="1"
                  className="transition-colors hover:fill-primary/20"
                />
                {isDamaged && (
                  <>
                    <circle cx={data.cx} cy={data.cy} r="8" fill="#EF4444" />
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

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {Object.entries(DAMAGE_TYPES).slice(0, 4).map(([key, val]) => (
          <span key={key} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: val.color }} />
            {val.label}
          </span>
        ))}
      </div>
    </div>
  )
}