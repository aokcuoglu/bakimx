/**
 * Turns a Sketchfab glTF export into the damage-viewer GLB served from /public/models/damage.
 *
 *   bun scripts/models/build-damage-model.ts <source scene.gltf> <body: sedan|suv> [out.glb]
 *
 * Output contract (read by src/components/damage/vehicle-3d-viewer.tsx):
 * - one node per damage zone, named after its VEHICLE_ZONES key; non-selectable body is one "trim" node,
 * - every primitive uses one of the shared ROLE materials (paint, glass, trim, lens, lens_red, chrome, rim, tire),
 * - interior, engine and chassis parts are dropped, textures removed, geometry meshopt-compressed.
 *
 * The source models are CC-BY 4.0 — keep the credit in src/components/damage/vehicle-3d-credits.ts in sync.
 */
import { statSync } from "node:fs"
import { Accessor, Document, NodeIO, type Primitive } from "@gltf-transform/core"
import { ALL_EXTENSIONS } from "@gltf-transform/extensions"
import { clearNodeTransform, dedup, flatten, meshopt, prune, quantize, reorder, weld } from "@gltf-transform/functions"
import { MeshoptEncoder } from "meshoptimizer"
import { VEHICLE_ZONES } from "../../src/lib/constants"

type Zone = keyof typeof VEHICLE_ZONES | "trim"
type Role = "paint" | "glass" | "trim" | "lens" | "lens_red" | "chrome" | "rim" | "tire"
type Rule = { match: RegExp; zone: Zone | ((side: "left" | "right") => Zone) | null }

const [source, body, out = `public/models/damage/${body}.glb`] = process.argv.slice(2)
if (!source || !["sedan", "suv"].includes(body ?? "")) throw new Error("usage: build-damage-model.ts <scene.gltf> <sedan|suv> [out.glb]")

const sideOf = (name: string): "left" | "right" | null =>
  /(^|[-_.])(left|l|fl|rl)([-_.]|$)/.test(name) ? "left" : /(^|[-_.])(right|r|fr|rr)([-_.]|$)/.test(name) ? "right" : null

/** First match wins. `null` drops the part; a function receives the side parsed from the node name. */
const RULES: Rule[] = [
  { match: /interior|door-panel|rearview|engine|mechanics|spring|suspension|exhaust|pedal|seat|dashboard|console|steering|carpet|lining|chassis-floor/, zone: null },
  { match: /^(wheel|tire|brake|rim)/, zone: "wheels" },
  { match: /^(bumper-front|front-grill|grille-front|bumper-front-grille)/, zone: "front_bumper" },
  { match: /drl|^headlight/, zone: (s) => `${s}_headlight` },
  { match: /^(bumper-rear|rear-splitter|diffuser)/, zone: "rear_bumper" },
  { match: /^hood/, zone: "hood" },
  { match: /windshield|^wiper-(left|right|front)/, zone: "windshield" },
  { match: /^glass-sunroof|^roof/, zone: "roof" },
  { match: /^glass-rear-frame/, zone: (s) => `${s}_rear_fender` },
  { match: /^glass-rear|^wiper-rear/, zone: "rear_window" },
  { match: /^taillight-(body|trunk)-(led|cover|back)-(left|right)|^taillight-(left|right)/, zone: (s) => `${s}_taillight` },
  { match: /^trunk|^tailgate/, zone: "trunk" },
  { match: /^(door-front|glass-door-front|mirror)/, zone: (s) => `${s}_front_door` },
  { match: /^(door-rear|glass-door-rear)/, zone: (s) => `${s}_rear_door` },
  { match: /^fender-front/, zone: (s) => `${s}_front_fender` },
  { match: /^fender-rear/, zone: (s) => `${s}_rear_fender` },
]

const ROLE_OF_MATERIAL: [RegExp, Role][] = [
  [/red/i, "lens_red"],
  [/glass-headlight|lens|light-cover/i, "lens"],
  [/glass/i, "glass"],
  [/tire/i, "tire"],
  [/wheel|brake|rim/i, "rim"],
  [/metal|chrome|mirror|lines/i, "chrome"],
  [/black|plastic|matte|rubber/i, "trim"],
  [/body|paint/i, "paint"],
]

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder })
const doc = await io.read(source)
const root = doc.getRoot()
await doc.transform(flatten())
for (const node of root.listNodes()) if (node.getMesh()) clearNodeTransform(node)

// Shared role materials: the viewer recolours these per zone, so they carry no textures.
const materials = Object.fromEntries((["paint", "glass", "trim", "lens", "lens_red", "chrome", "rim", "tire"] as Role[]).map((role) => [role, doc.createMaterial(role)])) as Record<Role, ReturnType<Document["createMaterial"]>>
materials.paint.setBaseColorFactor([0.86, 0.87, 0.88, 1]).setMetallicFactor(0.15).setRoughnessFactor(0.35)
materials.glass.setBaseColorFactor([0.08, 0.1, 0.12, 0.72]).setAlphaMode("BLEND").setMetallicFactor(0).setRoughnessFactor(0.05)
materials.trim.setBaseColorFactor([0.06, 0.06, 0.07, 1]).setMetallicFactor(0).setRoughnessFactor(0.55)
materials.lens.setBaseColorFactor([0.85, 0.9, 0.95, 0.45]).setAlphaMode("BLEND").setMetallicFactor(0).setRoughnessFactor(0.05)
materials.lens_red.setBaseColorFactor([0.62, 0.05, 0.06, 0.9]).setAlphaMode("BLEND").setMetallicFactor(0).setRoughnessFactor(0.15)
materials.chrome.setBaseColorFactor([0.75, 0.76, 0.78, 1]).setMetallicFactor(1).setRoughnessFactor(0.2)
materials.rim.setBaseColorFactor([0.42, 0.43, 0.45, 1]).setMetallicFactor(0.8).setRoughnessFactor(0.35)
materials.tire.setBaseColorFactor([0.05, 0.05, 0.05, 1]).setMetallicFactor(0).setRoughnessFactor(0.9)
const roleOf = (prim: Primitive): Role => {
  const name = prim.getMaterial()?.getName() ?? ""
  return ROLE_OF_MATERIAL.find(([re]) => re.test(name))?.[1] ?? "paint"
}

/** Copies the triangles whose centroid passes `keep` into a new primitive that shares the vertex data. */
function subset(prim: Primitive, keep: (c: [number, number, number]) => boolean): Primitive | null {
  const pos = prim.getAttribute("POSITION")!
  const idx = prim.getIndices()
  const count = idx ? idx.getCount() : pos.getCount()
  const at = (i: number) => (idx ? idx.getScalar(i) : i)
  const picked: number[] = []
  const a: number[] = [], b: number[] = [], c: number[] = []
  for (let i = 0; i < count; i += 3) {
    pos.getElement(at(i), a); pos.getElement(at(i + 1), b); pos.getElement(at(i + 2), c)
    if (keep([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3])) picked.push(at(i), at(i + 1), at(i + 2))
  }
  if (!picked.length) return null
  const copy = prim.clone()
  copy.setIndices(doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(new Uint32Array(picked)).setBuffer(root.listBuffers()[0]))
  return copy
}

const bounds = (prims: Primitive[]) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity], v: number[] = []
  for (const p of prims) { const a = p.getAttribute("POSITION")!; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], v[k]); max[k] = Math.max(max[k], v[k]) } } }
  return { min, max }
}

const zones = new Map<Zone, Primitive[]>()
const add = (zone: Zone, prim: Primitive) => { prim.setMaterial(materials[roleOf(prim)]); zones.set(zone, [...(zones.get(zone) ?? []), prim]) }
const unibody: Primitive[] = []
const sideLights: Primitive[] = []
const unmatched: string[] = []

for (const node of root.listNodes()) {
  const mesh = node.getMesh()
  if (!mesh) continue
  const name = node.getName().toLowerCase().replace(/_[^_]*_\d+$/, "")
  const rule = RULES.find((r) => r.match.test(name))
  const prims = mesh.listPrimitives()
  if (rule?.zone === null) continue
  if (/^(chassis|unibody|sedan-unibody|body-shell)/.test(name)) { unibody.push(...prims); continue }
  // Trunk-mounted lamp clusters span both sides: split them at the centre line.
  if (/^taillight-trunk-(cover|back)$/.test(name) || /^taillight-(cover|back)$/.test(name)) { sideLights.push(...prims); continue }
  if (!rule?.zone) { unmatched.push(name); continue }
  const side = sideOf(name)
  if (typeof rule.zone === "function" && !side) { unmatched.push(name); continue }
  for (const prim of prims) add(typeof rule.zone === "function" ? rule.zone(side!) : rule.zone, prim)
}
if (unmatched.length) throw new Error(`unclassified parts — add a rule:\n  ${[...new Set(unmatched)].join("\n  ")}`)

for (const prim of sideLights) {
  for (const side of ["left", "right"] as const) {
    const part = subset(prim, ([x]) => (side === "left" ? x >= 0 : x < 0))
    if (part) add(`${side}_taillight`, part)
  }
}

// The unibody carries roof and rear quarter panels. Split it with the doors as reference:
// above the door frames is roof, behind the rear doors on either flank is the rear fender.
const frontDoor = bounds([...(zones.get("left_front_door") ?? []), ...(zones.get("right_front_door") ?? [])])
const rearDoor = bounds([...(zones.get("left_rear_door") ?? []), ...(zones.get("right_rear_door") ?? [])])
const roofLine = Math.max(frontDoor.max[1], rearDoor.max[1]) - 0.01
const behindDoors = rearDoor.min[2] + 0.06
const flank = Math.min(frontDoor.min[0] > 0 ? frontDoor.min[0] : Infinity, rearDoor.min[0] > 0 ? rearDoor.min[0] : Infinity, 0.5) - 0.08
for (const prim of unibody) {
  const classify = ([x, y, z]: [number, number, number]): Zone =>
    y > roofLine ? "roof" : z < behindDoors && Math.abs(x) > flank ? (x > 0 ? "left_rear_fender" : "right_rear_fender") : "trim"
  for (const zone of ["roof", "left_rear_fender", "right_rear_fender", "trim"] as Zone[]) {
    const part = subset(prim, (c) => classify(c) === zone)
    if (part) add(zone, part)
  }
}

const missing = Object.keys(VEHICLE_ZONES).filter((z) => !zones.has(z as Zone))
if (missing.length) throw new Error(`model has no geometry for: ${missing.join(", ")}`)

// Rebuild the scene: one node per zone, everything else removed.
const scene = root.listScenes()[0]
for (const node of root.listNodes()) node.dispose()
for (const [zone, prims] of zones) {
  const mesh = doc.createMesh(zone)
  for (const prim of prims) mesh.addPrimitive(prim)
  scene.addChild(doc.createNode(zone).setMesh(mesh))
}
for (const tex of root.listTextures()) tex.dispose()

await doc.transform(prune(), dedup(), weld(), reorder({ encoder: MeshoptEncoder }), quantize(), meshopt({ encoder: MeshoptEncoder, level: "high" }))
await io.write(out, doc)
const tris = root.listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0)
console.log(`${out}: ${zones.size} zones, ${Math.round(tris)} triangles, ${(statSync(out).size / 1024).toFixed(0)} KB`)
