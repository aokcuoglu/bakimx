/**
 * Original BakımX representative drawing in the "açılım" (exploded) layout used by
 * Turkish appraisal reports: the body seen from above in the middle, both side
 * profiles folded outwards. Front is at the top, so the vehicle's left is the
 * viewer's left — no mirroring needed for driving-direction sides.
 */
export const BODY_TYPES = { sedan: "Binek", suv: "SUV", van: "Hafif ticari", unsupported: "Diğer / bölge listesi" } as const
export type BodyType = keyof typeof BODY_TYPES
export type VehiclePanel = { id: string; path: string; x: number; y: number; glass?: boolean; tire?: boolean }
export type VehicleLabel = { text: string; x: number; y: number; rotate?: number }
export type VehicleGeometry = { viewBox: string; panels: VehiclePanel[]; details: string[]; labels: VehicleLabel[] }

export const VEHICLE_VIEWBOX = "0 0 400 540"
const CX = 200
const WIDTH = 400

/** Cross-section of the top view: y position, half width and how far the edge bows towards the front. */
type Station = { y: number; w: number; bow: number }
type Proportions = {
  /** nose, bumper/hood, hood/windshield, windshield/roof, roof/rear window, rear window/trunk, trunk/bumper, tail */
  stations: [Station, Station, Station, Station, Station, Station, Station, Station]
  /** front fender start, A-pillar, B-pillar, C-pillar, rear fender end */
  side: [number, number, number, number, number]
  axles: [number, number]
  /** SUV and van side panels reach the roof behind the rear door. */
  tall: boolean
  quarterGlass: boolean
}

const PROPORTIONS: Record<Exclude<BodyType, "unsupported">, Proportions> = {
  sedan: {
    stations: [
      { y: 40, w: 54, bow: 14 }, { y: 60, w: 72, bow: 6 }, { y: 176, w: 76, bow: 12 }, { y: 230, w: 62, bow: 10 },
      { y: 330, w: 61, bow: -8 }, { y: 380, w: 72, bow: -10 }, { y: 470, w: 74, bow: -6 }, { y: 494, w: 56, bow: -14 },
    ],
    side: [60, 190, 285, 372, 470], axles: [118, 420], tall: false, quarterGlass: false,
  },
  suv: {
    stations: [
      { y: 40, w: 56, bow: 12 }, { y: 60, w: 74, bow: 6 }, { y: 160, w: 77, bow: 10 }, { y: 206, w: 68, bow: 8 },
      { y: 386, w: 68, bow: -4 }, { y: 410, w: 74, bow: -6 }, { y: 470, w: 76, bow: -4 }, { y: 494, w: 60, bow: -10 },
    ],
    side: [60, 176, 278, 374, 470], axles: [112, 420], tall: true, quarterGlass: true,
  },
  van: {
    stations: [
      { y: 40, w: 60, bow: 12 }, { y: 60, w: 76, bow: 6 }, { y: 122, w: 78, bow: 8 }, { y: 168, w: 74, bow: 6 },
      { y: 424, w: 76, bow: 0 }, { y: 446, w: 77, bow: -2 }, { y: 478, w: 77, bow: 0 }, { y: 498, w: 66, bow: -6 },
    ],
    side: [60, 140, 236, 400, 478], axles: [98, 430], tall: true, quarterGlass: false,
  },
}

// Side strip, measured from the outer edge (wheels) towards the body.
const OUTER = 44, BELT = 82, ROOF = 104
const WHEEL_R = 19, ARCH_R = 24

const n = (v: number) => Math.round(v * 10) / 10
const centerPanel = (id: string, a: Station, b: Station, glass = false): VehiclePanel => ({
  id,
  path: `M${n(CX - a.w)},${a.y}Q${CX},${n(a.y - a.bow)} ${n(CX + a.w)},${a.y}L${n(CX + b.w)},${b.y}Q${CX},${n(b.y - b.bow)} ${n(CX - b.w)},${b.y}Z`,
  x: CX,
  y: n((a.y + b.y) / 2),
  glass,
})

/** Builds the left-side strip; the right side mirrors the x axis and the arc sweep. */
function sideStrip(side: "left" | "right", p: Proportions) {
  const X = (x: number) => (side === "left" ? x : WIDTH - x)
  const sweep = side === "left" ? 0 : 1
  const pt = (x: number, y: number) => `${n(X(x))},${n(y)}`
  const [start, a, b, c, end] = p.side
  const [axleF, axleR] = p.axles
  const arch = (axle: number) => `L${pt(OUTER, axle + ARCH_R)}A${ARCH_R},${ARCH_R} 0 0,${sweep} ${pt(OUTER, axle - ARCH_R)}`
  const rearInner = p.tall ? ROOF : BELT
  const mid = (OUTER + BELT) / 2
  const panels: VehiclePanel[] = [
    {
      id: `${side}_front_fender`,
      path: `M${pt(OUTER, start + 16)}Q${pt(OUTER, start)} ${pt(OUTER + 16, start)}L${pt(BELT - 6, start + 2)}Q${pt(BELT, start + 4)} ${pt(BELT, start + 12)}L${pt(BELT, a)}L${pt(OUTER, a)}${arch(axleF)}Z`,
      x: X(mid + 4), y: n((axleF + ARCH_R + a) / 2),
    },
    {
      id: `${side}_front_door`,
      path: `M${pt(OUTER, a)}L${pt(BELT, a)}L${pt(ROOF, a + 34)}L${pt(ROOF, b)}L${pt(OUTER, b)}Z`,
      x: X(mid), y: n((a + b) / 2),
    },
    {
      id: `${side}_rear_door`,
      path: p.tall
        ? `M${pt(OUTER, b)}L${pt(ROOF, b)}L${pt(ROOF, c)}L${pt(OUTER, c)}Z`
        : `M${pt(OUTER, b)}L${pt(ROOF, b)}L${pt(ROOF, c - 30)}L${pt(BELT, c)}L${pt(OUTER, c)}Z`,
      x: X(mid), y: n((b + c) / 2),
    },
    {
      id: `${side}_rear_fender`,
      path: `M${pt(OUTER, c)}L${pt(rearInner, c)}L${pt(rearInner, end - 14)}Q${pt(rearInner, end)} ${pt(rearInner - 14, end)}L${pt(OUTER + 16, end)}Q${pt(OUTER, end)} ${pt(OUTER, end - 16)}${arch(axleR)}Z`,
      x: X(mid + 4), y: n((c + axleR - ARCH_R) / 2),
    },
  ]
  const details = [
    // Side glass sits between the belt line and the roof rail.
    `M${pt(BELT + 4, a + 12)}L${pt(ROOF - 5, a + 38)}L${pt(ROOF - 5, b - 5)}L${pt(BELT + 4, b - 5)}Z`,
    p.tall
      ? `M${pt(BELT + 4, b + 5)}L${pt(ROOF - 5, b + 5)}L${pt(ROOF - 5, c - 5)}L${pt(BELT + 4, c - 5)}Z`
      : `M${pt(BELT + 4, b + 5)}L${pt(ROOF - 5, b + 5)}L${pt(ROOF - 5, c - 34)}L${pt(BELT + 4, c - 9)}Z`,
    ...(p.quarterGlass ? [`M${pt(BELT + 4, c + 5)}L${pt(ROOF - 5, c + 5)}L${pt(ROOF - 5, c + 44)}L${pt(BELT + 4, c + 58)}Z`] : []),
    // Door handles.
    `M${pt(BELT - 9, b - 26)}V${n(b - 12)}M${pt(BELT - 9, c - 26)}V${n(c - 12)}`,
  ]
  // Circles are drawn from their mirrored centre so the relative arcs need no flipping.
  const circle = (axle: number, r: number) => `M${n(X(OUTER + 2) - r)},${axle}a${r},${r} 0 1,0 ${r * 2},0a${r},${r} 0 1,0 -${r * 2},0`
  const wheels = p.axles.map((axle) => circle(axle, WHEEL_R))
  const hubs = p.axles.map((axle) => circle(axle, 8))
  return { panels, details: [...details, ...hubs], wheels, hubCenter: { x: X(OUTER + 2), y: axleF } }
}

export function getVehicleGeometry(body: BodyType): VehicleGeometry {
  if (body === "unsupported") return { viewBox: VEHICLE_VIEWBOX, panels: [], details: [], labels: [] }
  const p = PROPORTIONS[body]
  const [nose, hoodFront, hoodRear, roofFront, roofRear, trunkFront, trunkRear, tail] = p.stations
  const left = sideStrip("left", p), right = sideStrip("right", p)
  // Lamps sit on the body corners, measured from the edge of the station they straddle.
  const lamp = (side: "left" | "right", front: boolean): VehiclePanel => {
    const s = front ? hoodFront : trunkRear
    const X = (dx: number) => n(side === "left" ? CX - s.w + dx : CX + s.w - dx)
    const y = s.y
    const path = front
      ? `M${X(3)},${y - 6}Q${X(16)},${y - 13} ${X(34)},${y - 9}L${X(32)},${y + 4}L${X(6)},${y + 6}Z`
      : `M${X(3)},${y - 10}L${X(30)},${y - 9}L${X(30)},${y + 3}Q${X(14)},${y + 8} ${X(4)},${y + 3}Z`
    return { id: `${side}_${front ? "headlight" : "taillight"}`, path, x: X(18), y }
  }
  const panels: VehiclePanel[] = [
    centerPanel("front_bumper", nose, hoodFront),
    centerPanel("hood", hoodFront, hoodRear),
    centerPanel("windshield", hoodRear, roofFront, true),
    centerPanel("roof", roofFront, roofRear),
    centerPanel("rear_window", roofRear, trunkFront, true),
    centerPanel("trunk", trunkFront, trunkRear),
    centerPanel("rear_bumper", trunkRear, tail),
    ...left.panels,
    ...right.panels,
    lamp("left", true), lamp("right", true), lamp("left", false), lamp("right", false),
    { id: "wheels", path: [...left.wheels, ...right.wheels].join(""), x: left.hubCenter.x, y: left.hubCenter.y, tire: true },
  ]
  // A soft crease gives the flat hood some depth.
  const details = [
    ...left.details,
    ...right.details,
    `M${CX - 24},${n(hoodFront.y + 18)}Q${CX},${n(hoodFront.y + 12)} ${CX + 24},${n(hoodFront.y + 18)}`,
  ]
  const midY = n((p.side[1] + p.side[3]) / 2)
  const labels: VehicleLabel[] = [
    { text: "ÖN", x: CX, y: 20 },
    { text: "ARKA", x: CX, y: 528 },
    { text: "SOL", x: 12, y: midY, rotate: -90 },
    { text: "SAĞ", x: WIDTH - 12, y: midY, rotate: 90 },
  ]
  return { viewBox: VEHICLE_VIEWBOX, panels, details, labels }
}
