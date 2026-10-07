"use client"

import { Suspense, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber"
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { RotateCcw } from "lucide-react"
import { VEHICLE_ZONES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { VEHICLE_3D_MODELS, type Vehicle3DModel } from "./vehicle-3d-models"

type ZoneId = keyof typeof VEHICLE_ZONES
export type Vehicle3DViewerProps = {
  model: Vehicle3DModel
  /** Permanent damage numbers per zone, used for the tint and the number callouts. */
  marks: Partial<Record<string, number[]>>
  onZoneClick?: (zone: string) => void
}

// WebGL cannot read CSS custom properties; these mirror the warning / primary theme tones.
const DAMAGE_TINT = new THREE.Color("#f59e0b")
const HOVER_TINT = new THREE.Color("#3b82f6")
// Roles the viewer recolours; trim, chrome and tyres keep their colour so the car stays legible.
const TINTED_ROLES = new Set(["paint", "glass", "lens", "lens_red", "rim"])
const isZone = (name: string): name is ZoneId => name in VEHICLE_ZONES
/** A pointer that travelled further than this between down and up was a rotate, not a tap. */
const TAP_TOLERANCE_PX = 6

type ZoneAnchor = { center: THREE.Vector3; facing: THREE.Vector3 }

function CarModel({ model, marks, onZoneClick, hovered, setHovered, onReady }: Vehicle3DViewerProps & { hovered: ZoneId | null; setHovered: (zone: ZoneId | null) => void; onReady: (anchors: Map<ZoneId, ZoneAnchor>) => void }) {
  const { scene } = useGLTF(VEHICLE_3D_MODELS[model].url, false, true)
  // Every zone gets its own material copies so tinting one panel never bleeds into another.
  const { root, zones, ground } = useMemo(() => {
    const root = scene.clone(true)
    type ZoneEntry = { meshes: THREE.Mesh[]; base: Map<THREE.Material, THREE.Color>; center: THREE.Vector3; facing: THREE.Vector3 }
    const zones = new Map<ZoneId, ZoneEntry>()
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.material = (obj.material as THREE.MeshStandardMaterial).clone()
      const zone = obj.parent && isZone(obj.parent.name) ? obj.parent.name : isZone(obj.name) ? obj.name : null
      if (!zone) return
      const entry: ZoneEntry = zones.get(zone) ?? { meshes: [], base: new Map(), center: new THREE.Vector3(), facing: new THREE.Vector3() }
      entry.meshes.push(obj)
      entry.base.set(obj.material, (obj.material as THREE.MeshStandardMaterial).color.clone())
      zones.set(zone, entry)
    })
    root.updateMatrixWorld(true)
    const carCenter = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3())
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), out = new THREE.Vector3()
    for (const entry of zones.values()) {
      new THREE.Box3().setFromObject(entry.meshes[0].parent ?? entry.meshes[0]).getCenter(entry.center)
      // Area-weighted triangle normals, each flipped to point away from the car's centre, give the
      // way the panel faces (hood up, door sideways) regardless of inner skins or winding order.
      for (const mesh of entry.meshes) {
        const pos = mesh.geometry.getAttribute("position")
        const index = mesh.geometry.getIndex()
        const count = index ? index.count : pos.count
        for (let i = 0; i < count; i += 3) {
          const [ia, ib, ic] = index ? [index.getX(i), index.getX(i + 1), index.getX(i + 2)] : [i, i + 1, i + 2]
          a.fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld)
          b.fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld)
          c.fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld)
          n.subVectors(b, a).cross(out.subVectors(c, a))
          out.addVectors(a, b).add(c).divideScalar(3).sub(carCenter)
          entry.facing.add(n.dot(out) < 0 ? n.negate() : n)
        }
      }
      entry.facing.normalize()
    }
    return { root, zones, ground: new THREE.Box3().setFromObject(root).min.y }
  }, [scene])

  useEffect(() => onReady(zones), [onReady, zones])

  useEffect(() => {
    for (const [zone, entry] of zones) {
      const tint = marks[zone]?.length ? DAMAGE_TINT : hovered === zone ? HOVER_TINT : null
      for (const mesh of entry.meshes) {
        const material = mesh.material as THREE.MeshStandardMaterial
        const base = entry.base.get(material)!
        const tinted = tint && TINTED_ROLES.has(material.name)
        material.color.copy(tinted ? base.clone().lerp(tint, material.name === "paint" ? 0.78 : 0.55) : base)
        material.emissive.copy(tinted && hovered === zone ? tint : new THREE.Color(0)).multiplyScalar(0.12)
      }
    }
  }, [zones, marks, hovered])

  const zoneOf = (event: ThreeEvent<PointerEvent | MouseEvent>): ZoneId | null => {
    const obj = event.object
    return obj.parent && isZone(obj.parent.name) ? obj.parent.name : isZone(obj.name) ? obj.name : null
  }

  return <>
    <primitive
      object={root}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); const zone = zoneOf(e); if (zone !== hovered) setHovered(zone) }}
      onPointerOut={() => setHovered(null)}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        const zone = zoneOf(e)
        if (zone && onZoneClick && e.delta <= TAP_TOLERANCE_PX) onZoneClick(zone)
      }}
    />
    <ContactShadows position={[0, ground + 0.002, 0]} opacity={0.42} scale={7} blur={2.4} far={2} resolution={512} />
  </>
}

/**
 * Moves the DOM damage badges onto their panels every frame. Badges live outside the canvas in the
 * normal React tree (drei's <Html> mounts a root per badge, which React 19 warns about on unmount).
 * A badge hides once its panel turns away from the camera, so far-side numbers never show through
 * the body; zones without a dominant direction (the four wheels together) always show.
 */
const projected = new THREE.Vector3()
const toCamera = new THREE.Vector3()
/** Places one badge over its panel; kept outside the component because it writes to the DOM node. */
function placeBadge(el: HTMLDivElement, anchor: ZoneAnchor | undefined, camera: THREE.Camera, width: number, height: number) {
  if (!anchor) { el.style.visibility = "hidden"; return }
  const facing = anchor.facing.lengthSq() < 0.5 || toCamera.subVectors(camera.position, anchor.center).normalize().dot(anchor.facing) > 0.05
  projected.copy(anchor.center).project(camera)
  el.style.visibility = facing ? "visible" : "hidden"
  el.style.transform = `translate(${((projected.x + 1) / 2) * width}px, ${((1 - projected.y) / 2) * height}px) translate(-50%, -50%)`
}

function BadgeProjector({ anchors, badges }: { anchors: Map<ZoneId, ZoneAnchor>; badges: RefObject<Map<string, HTMLDivElement>> }) {
  useFrame(({ camera, size }) => {
    for (const [zone, el] of badges.current) placeBadge(el, anchors.get(zone as ZoneId), camera, size.width, size.height)
  })
  return null
}

/** Front three-quarter view, matching how a workshop first walks up to the car. */
const HOME_DIRECTION = new THREE.Vector3(3.3, 1.45, 3.7).normalize()
/** Radius of a sphere that encloses a passenger car (metres). */
const CAR_RADIUS = 2.3

type Orbit = { target: THREE.Vector3; update: () => void; minDistance: number; maxDistance: number }
/** Puts the camera on the home direction at a distance that fits the car into the canvas aspect. */
function frameCar(camera: THREE.PerspectiveCamera, orbit: Orbit | null, width: number, height: number) {
  const vertical = THREE.MathUtils.degToRad(camera.fov) / 2
  const horizontal = Math.atan(Math.tan(vertical) * (width / height))
  const distance = (CAR_RADIUS / Math.sin(Math.min(vertical, horizontal))) * 0.82
  camera.position.copy(HOME_DIRECTION).multiplyScalar(distance)
  if (!orbit) return
  orbit.minDistance = distance * 0.55
  orbit.maxDistance = distance * 1.6
  orbit.target.set(0, 0, 0)
  orbit.update()
}

/** Keeps the whole car in frame for any canvas aspect; re-runs on resize and on "reset view". */
function FitCamera({ signal }: { signal: number }) {
  const { camera, controls, size } = useThree()
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) frameCar(camera, controls as unknown as Orbit | null, size.width, size.height)
  }, [signal, camera, controls, size.width, size.height])
  return null
}

export default function Vehicle3DViewer(props: Vehicle3DViewerProps) {
  const [hovered, setHovered] = useState<ZoneId | null>(null)
  const [reset, setReset] = useState(0)
  const [anchors, setAnchors] = useState<Map<ZoneId, ZoneAnchor> | null>(null)
  const badges = useRef(new Map<string, HTMLDivElement>())
  const wrapper = useRef<HTMLDivElement>(null)
  const credit = VEHICLE_3D_MODELS[props.model].credit

  useEffect(() => {
    if (wrapper.current) wrapper.current.style.cursor = hovered && props.onZoneClick ? "pointer" : "grab"
  }, [hovered, props.onZoneClick])

  return <div className="space-y-1.5">
    <div ref={wrapper} className="relative h-[320px] w-full touch-none overflow-hidden rounded-xl border bg-card sm:h-[400px]">
      <Canvas dpr={[1, 2]} camera={{ position: [6, 2.6, 6.7], fov: 30, near: 0.1, far: 50 }} gl={{ antialias: true, preserveDrawingBuffer: false }} aria-label="3B araç hasar modeli">
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 8, 4]} intensity={1.1} />
        <Environment resolution={256}>
          <Lightformer form="rect" intensity={2.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={1.2} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[8, 2, 1]} />
          <Lightformer form="rect" intensity={0.8} position={[0, 2, 6]} scale={[8, 2, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <CarModel {...props} hovered={hovered} setHovered={setHovered} onReady={setAnchors} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableDamping minPolarAngle={0.25} maxPolarAngle={Math.PI / 2 - 0.04} />
        <FitCamera signal={reset} />
        {anchors && <BadgeProjector anchors={anchors} badges={badges} />}
      </Canvas>
      {Object.entries(props.marks).filter(([, numbers]) => numbers?.length).map(([zone, numbers]) => (
        <div key={zone} ref={(el) => { if (el) badges.current.set(zone, el); else badges.current.delete(zone) }} className="pointer-events-none invisible absolute left-0 top-0 flex gap-0.5">
          {numbers!.map((n) => <span key={n} className="grid size-6 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background shadow-sm ring-2 ring-card">{n}</span>)}
        </div>
      ))}
      {!anchors && <div className="pointer-events-none absolute inset-0 grid place-items-center"><BrandSpinner size={40} label="3B model yükleniyor" /></div>}
      <div className="pointer-events-none absolute left-3 top-3 min-h-6 text-sm font-medium" aria-live="polite">
        {hovered && <span className="rounded-md bg-background/90 px-2 py-1 shadow-sm">{VEHICLE_ZONES[hovered]}</span>}
      </div>
      <Button type="button" variant="outline" size="icon-sm" className="absolute right-3 top-3" aria-label="Görünümü sıfırla" onClick={() => setReset((n) => n + 1)}><RotateCcw /></Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Döndürmek için sürükleyin, yakınlaştırmak için kaydırın; hasar eklemek için panele dokunun.{" "}
      <a href={credit.source} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">3B model: {credit.author}</a> (<a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">CC BY 4.0</a>, uyarlandı).
    </p>
  </div>
}
