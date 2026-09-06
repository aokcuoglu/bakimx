/** Original BakımX representative drawings. Left/right always refer to driving direction. */
export const BODY_TYPES = { sedan: "Binek", suv: "SUV", van: "Hafif ticari", unsupported: "Diğer / bölge listesi" } as const
export const VEHICLE_VIEWS = { front: "Ön", rear: "Arka", left: "Sol", right: "Sağ", top: "Üst" } as const
export type BodyType = keyof typeof BODY_TYPES
export type VehicleView = keyof typeof VEHICLE_VIEWS
export type VehiclePanel = { id: string; path: string; x: number; y: number; glass?: boolean }
const box = (id: string, x: number, y: number, w: number, h: number, glass = false): VehiclePanel => ({ id, path: `M${x},${y}h${w}v${h}h-${w}Z`, x: x + w / 2, y: y + h / 2, glass })
const panel = (id: string, path: string, x: number, y: number, glass = false): VehiclePanel => ({ id, path, x, y, glass })
export function getVehicleGeometry(body: BodyType, view: VehicleView): { panels: VehiclePanel[]; details: string[] } {
  if (body === "unsupported") return { panels: [], details: [] }
  const tall = body !== "sedan", van = body === "van", roof = van ? 50 : tall ? 65 : 90
  if (view === "left" || view === "right") {
    const side = view
    const panels = [
      panel("hood", `M45,160L130,145L142,155L48,172Z`, 94,158),
      panel(`${side}_front_fender`, "M42,175L145,155L145,225L130,225Q117,179 80,200L65,225H38Z", 80,181),
      panel(`${side}_front_door`, `M148,155L${van ? 165 : 190},${roof}H248V226H148Z`, 199,184),
      panel(`${side}_rear_door`, `M251,${roof}H${van ? 354 : 320}L350,150V226H251Z`, 295,184),
      panel(`${side}_rear_fender`, `M353,151L${van ? 427 : 405},${van ? roof : 155}L440,175V226H417Q402,181 368,203L358,226H353Z`, 393,181),
      box("front_bumper", 28,204,32,24), box("rear_bumper",424,204,28,24),
      box(`${side}_headlight`,39,177,26,15), box(`${side}_taillight`,420,170,20,25),
      panel("roof", `M${van ? 165 : 190},${roof - 8}H${van ? 425 : 320}L${van ? 427 : 330},${roof}H${van ? 165 : 190}Z`, 265,roof-4),
      panel("wheels", "M125,228a27,27 0 1,0 -54,0a27,27 0 1,0 54,0 M418,228a27,27 0 1,0 -54,0a27,27 0 1,0 54,0",98,228),
    ]
    // Window and handle details remain visible even before a panel is selected.
    const details = [`M159,147L${van ? 174 : 196},${roof + 9}H237V147Z`, `M261,${roof + 9}H${van ? 344 : 314}L337,147H261Z`, "M219,169h15 M319,169h15", "M111,228a13,13 0 1,0 -26,0a13,13 0 1,0 26,0 M404,228a13,13 0 1,0 -26,0a13,13 0 1,0 26,0"]
    return { panels, details }
  }
  if (view === "front" || view === "rear") {
    const front = view === "front"
    const panels = [
      panel(front ? "windshield" : "rear_window", `M130,${roof}H350L375,145H105Z`,240,(roof+145)/2,true),
      panel("roof", `M130,${roof}Q240,${roof-20}350,${roof}Z`,240,roof-5),
      panel(front ? "hood" : "trunk", "M105,149H375L392,199H88Z",240,175),
      panel(front ? "front_bumper" : "rear_bumper", "M87,203H393L385,237H95Z",240,218),
      // Facing the front reverses the viewer's left/right.
      box(`${front ? "right_headlight" : "left_taillight"}`,95,168,58,25),
      box(`${front ? "left_headlight" : "right_taillight"}`,327,168,58,25),
      panel("wheels", "M84,205h12v46H84Z M384,205h12v46H384Z",90,247),
    ]
    return { panels, details: ["M182,211h116v18H182Z", ...(front ? ["M169,184h142 M173,190h134"] : [])] }
  }
  const rear = van ? 245 : tall ? 235 : 220
  return { panels: [
    panel("front_bumper","M177,25Q240,13 303,25L310,45H170Z",240,31),
    panel("hood","M171,48H309L304,94H176Z",240,70),
    panel("windshield","M177,97H303L290,127H190Z",240,110,true),
    box("roof",191,130,98,rear-175),
    panel("rear_window",`M191,${rear-42}H289L304,${rear-15}H176Z`,240,rear-28,true),
    panel("trunk",`M175,${rear-12}H305V260H175Z`,240,(rear+248)/2),
    panel("rear_bumper","M173,263H307L300,281Q240,291 180,281Z",240,274),
    ...(["left","right"] as const).flatMap((side) => { const x = side === "left" ? 148 : 310; return [box(`${side}_front_fender`,x,49,20,52),box(`${side}_front_door`,x,104,20,64),box(`${side}_rear_door`,x,171,20,51),box(`${side}_rear_fender`,x,225,20,36),box(`${side}_headlight`,x+3,28,16,17),box(`${side}_taillight`,x+3,263,16,16)] }),
    panel("wheels","M136,75h10v30h-10Z M334,75h10v30h-10Z M136,225h10v30h-10Z M334,225h10v30h-10Z",140,90),
  ], details: [] }
}
