import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { buildShape, SHAPES, shapeLimits } from './geometry/shapes.js'
import {
  rotatePoints,
  projectTo3D,
  makeAutoRotations,
} from './math/ndmath.js'
import { applyShapeChange } from './math/motion.js'
import { LinesRenderer } from './render/linesRenderer.js'
import { PlanesRenderer } from './render/planesRenderer.js'
import { createPanel } from './ui/panel.js'
import { FpsMeter } from './ui/fps.js'

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------
const PROJECT_DISTANCE = 3 // viewing distance used per N-D perspective collapse
const DEFAULT_DIM = 3
const MANUAL_DRAG_PX = 6
const FLING_PX_PER_SECOND = 850
const SPACE_ROTATION_X_SPEED = 0.11
const SPACE_ROTATION_Y_SPEED = 0.235
const SHAPE_CHANGE_SPEED = 0.45

const state = {
  type: 'hypercube', // one of SHAPES[*].value
  dim: DEFAULT_DIM,
  sides: 0,
  mode: 'lines', // 'lines' | 'planes'
  projection: 'perspective', // 'perspective' | 'orthographic'
  spaceRotating: true,
  shapeChanging: true,
}

// ---------------------------------------------------------------------------
// Three.js setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x000000)

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.01,
  100,
)
camera.position.set(0, 0, 4.2)

// Manual rotate (drag) + zoom. Pan/keyboard disabled => "no camera movement controls".
const controls = new OrbitControls(camera, canvas)
controls.enablePan = false
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.rotateSpeed = 0.9
controls.zoomSpeed = 0.9
controls.minDistance = 1.2
controls.maxDistance = 18

// Lighting — only relevant to "planes" mode (line materials ignore lights).
// A single external key light so light visibly plays across morphing surfaces.
const ambient = new THREE.AmbientLight(0xffffff, 0.22)
scene.add(ambient)
const keyLight = new THREE.PointLight(0xffffff, 60, 0, 2)
keyLight.position.set(4, 5, 6) // outside the object
scene.add(keyLight)
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.35)
fillLight.position.set(-5, -3, -4)
scene.add(fillLight)

// Container that both renderers attach into.
const objectGroup = new THREE.Group()
scene.add(objectGroup)

const linesRenderer = new LinesRenderer()
const planesRenderer = new PlanesRenderer()

// ---------------------------------------------------------------------------
// Live shape state (rebuilt on dim/sides/type change)
// ---------------------------------------------------------------------------
let shape = null // { vertices:number[][], edges:[i,j][], faces:number[][] }
let baseVertices = null // un-rotated, normalized N-D vertices
let rotations = null // auto-rotation plane descriptors
let activeRenderer = null
let panel = null
let shapeChangePhase = 0

function rebuildShape() {
  shape = buildShape(state.type, state.dim, state.sides)
  baseVertices = shape.vertices

  // Carry over the current rotation angles so the tumble keeps moving
  // continuously when settings change instead of snapping back to the start.
  // Planes that still exist (same axis pair) keep their angle; new planes
  // (added when the dimension increases) start at 0.
  const prev = rotations || []
  rotations = makeAutoRotations(state.dim)
  for (const r of rotations) {
    const match = prev.find((p) => p.i === r.i && p.j === r.j)
    if (match) r.angle = match.angle
  }
  if (panel) panel.setShapeChangeEnabled(state.dim > 3)
  applyMode(state.mode)
}

function applyMode(mode) {
  state.mode = mode
  objectGroup.clear()
  activeRenderer = mode === 'planes' ? planesRenderer : linesRenderer
  activeRenderer.build(shape)
  objectGroup.add(activeRenderer.object3D)
  keyLight.visible = mode === 'planes'
  fillLight.visible = mode === 'planes'
  ambient.visible = mode === 'planes'
  projectAndUpdate()
}

function projectAndUpdate() {
  if (!activeRenderer || !baseVertices) return
  const changed = applyShapeChange(
    baseVertices,
    shapeChangePhase,
    state.shapeChanging,
  )
  const rotated = rotatePoints(changed, rotations)
  const projected = projectTo3D(rotated, state.projection, PROJECT_DISTANCE)
  activeRenderer.update(projected)
}

// ---------------------------------------------------------------------------
// UI panel
// ---------------------------------------------------------------------------
function setSpaceRotating(on) {
  state.spaceRotating = on
  if (panel) panel.setRotate(on)
}

function setShapeChanging(on) {
  state.shapeChanging = on
  if (panel) panel.setShapeChange(on)
  // Toggling off returns the shape to its undeformed, canonical projection:
  // the pulse is gated inside applyShapeChange, and resetting the depth-plane
  // angles here snaps the morph back to its textbook view instead of
  // freezing it mid-deformation.
  if (!on) {
    for (const rotation of rotations || []) rotation.angle = 0
    shapeChangePhase = 0
  }
  projectAndUpdate()
}

function advanceShapeChange(dtSeconds) {
  if (!state.shapeChanging || state.dim <= 3) return

  shapeChangePhase += SHAPE_CHANGE_SPEED * dtSeconds
  // makeAutoRotations only emits depth-like morph planes, so every rotation
  // here belongs to Shape Change.
  for (const rotation of rotations) {
    rotation.angle += rotation.speed * dtSeconds
  }
  projectAndUpdate()
}

function advanceSpaceRotation(dtSeconds) {
  if (!state.spaceRotating) return
  objectGroup.rotation.x += SPACE_ROTATION_X_SPEED * dtSeconds
  objectGroup.rotation.y += SPACE_ROTATION_Y_SPEED * dtSeconds
}

panel = createPanel({
  shapes: SHAPES,
  state,
  onShape: (value) => {
    state.type = value
    // New shapes start in the default 3-D view (clamped if a future shape
    // cannot support it). The side count is clamped to the selected shape's
    // mathematical range, so fixed-side shapes immediately show their fixed
    // value and cannot be pushed beyond it.
    const lim = shapeLimits(value)
    state.dim = clamp(DEFAULT_DIM, lim.dimMin, lim.dimMax)
    state.sides = clamp(state.sides, lim.sidesMin, lim.sidesMax)
    rebuildShape()
    panel.syncShape(value, state.dim, state.sides)
  },
  onDim: (value) => {
    const lim = shapeLimits(state.type)
    state.dim = clamp(value, lim.dimMin, lim.dimMax)
    rebuildShape()
  },
  onSides: (value) => {
    const lim = shapeLimits(state.type)
    state.sides = clamp(value, lim.sidesMin, lim.sidesMax)
    rebuildShape()
  },
  onMode: (mode) => applyMode(mode),
  onProjection: (projection) => {
    state.projection = projection
    projectAndUpdate()
  },
  onRotateToggle: (on) => {
    setSpaceRotating(on)
  },
  onShapeChangeToggle: (on) => {
    setShapeChanging(on)
  },
})
document.getElementById('ui').appendChild(panel.el)

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value))
}

// ---------------------------------------------------------------------------
// Manual interaction policy
// ---------------------------------------------------------------------------
let manualPointer = null

function onManualPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return
  try {
    canvas.setPointerCapture(e.pointerId)
  } catch {
    // Pointer capture is best-effort; OrbitControls still handles the drag.
  }
  manualPointer = {
    id: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    startTime: performance.now(),
    lastX: e.clientX,
    lastY: e.clientY,
    lastTime: performance.now(),
    maxVelocity: 0,
    moved: false,
    wasSpaceRotating: state.spaceRotating,
  }
}

function onManualPointerMove(e) {
  if (!manualPointer || e.pointerId !== manualPointer.id) return

  const totalDx = e.clientX - manualPointer.startX
  const totalDy = e.clientY - manualPointer.startY
  const now = performance.now()
  const stepDx = e.clientX - manualPointer.lastX
  const stepDy = e.clientY - manualPointer.lastY
  const dt = Math.max(1, now - manualPointer.lastTime)
  const velocity = (1000 * Math.hypot(stepDx, stepDy)) / dt
  manualPointer.maxVelocity = Math.max(manualPointer.maxVelocity, velocity)
  manualPointer.lastX = e.clientX
  manualPointer.lastY = e.clientY
  manualPointer.lastTime = now

  if (!manualPointer.moved && Math.hypot(totalDx, totalDy) >= MANUAL_DRAG_PX) {
    manualPointer.moved = true
    if (state.spaceRotating) setSpaceRotating(false)
  }
}

function onManualPointerEnd(e) {
  if (!manualPointer || e.pointerId !== manualPointer.id) return
  const now = performance.now()
  const totalDistance = Math.hypot(
    e.clientX - manualPointer.startX,
    e.clientY - manualPointer.startY,
  )
  const totalTime = Math.max(1, now - manualPointer.startTime)
  const averageVelocity = (1000 * totalDistance) / totalTime
  const wasFling =
    Math.max(manualPointer.maxVelocity, averageVelocity) >= FLING_PX_PER_SECOND
  const shouldHandBackToAutoRotate =
    manualPointer.moved && !manualPointer.wasSpaceRotating && wasFling
  manualPointer = null
  try {
    canvas.releasePointerCapture(e.pointerId)
  } catch {
    // Ignore if capture was not available or already released.
  }
  if (shouldHandBackToAutoRotate && !state.spaceRotating) {
    setSpaceRotating(true)
  }
}

canvas.addEventListener('pointerdown', onManualPointerDown)
canvas.addEventListener('pointermove', onManualPointerMove)
canvas.addEventListener('pointerup', onManualPointerEnd)
canvas.addEventListener('pointercancel', onManualPointerEnd)

// ---------------------------------------------------------------------------
// Render loop — throttled to 60fps
// ---------------------------------------------------------------------------
const fps = new FpsMeter()
// Cap at ~60fps. The threshold sits a hair below a true 60Hz frame (1000/62)
// so a real 60Hz display never beat-frequency-skips a jittery frame, while
// 120/144Hz displays are still throttled down. The modulo accumulator on
// lastFrame keeps the long-run average pinned to the cap.
const FRAME_MS = 1000 / 62
// Ceiling on a single simulation step so returning from a background tab
// (where requestAnimationFrame pauses) doesn't teleport the animation.
const MAX_STEP_MS = 100
let lastFrame = performance.now()

function loop(now) {
  requestAnimationFrame(loop)

  const elapsed = now - lastFrame
  if (elapsed < FRAME_MS) return
  const remainder = elapsed % FRAME_MS
  lastFrame = now - remainder
  // Advance the simulation by exactly the time consumed (elapsed minus the
  // remainder credited back into lastFrame) — using the full `elapsed` here
  // would double-count the remainder and run the animation too fast.
  const dt = Math.min(elapsed - remainder, MAX_STEP_MS) / 1000

  advanceSpaceRotation(dt)
  advanceShapeChange(dt)

  controls.update()
  renderer.render(scene, camera)

  fps.tick(now)
  panel.setFps(fps.value)
}

// ---------------------------------------------------------------------------
// Resize handling
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
}
window.addEventListener('resize', onResize)

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
onResize()
rebuildShape()
requestAnimationFrame(loop)
