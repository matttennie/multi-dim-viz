import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { buildShape, SHAPES } from './geometry/shapes.js'
import {
  rotatePoints,
  projectTo3D,
  makeAutoRotations,
  advanceRotations,
} from './math/ndmath.js'
import { LinesRenderer } from './render/linesRenderer.js'
import { PlanesRenderer } from './render/planesRenderer.js'
import { createPanel } from './ui/panel.js'
import { FpsMeter } from './ui/fps.js'

// ---------------------------------------------------------------------------
// Application state
// ---------------------------------------------------------------------------
const DIM_MIN = 1
const DIM_MAX = 8
const SIDES_MIN = 3
const SIDES_MAX = 24
const PROJECT_DISTANCE = 3 // viewing distance used per N-D perspective collapse

const state = {
  type: 'hypercube', // one of SHAPES[*].value
  dim: 4,
  sides: 6,
  mode: 'lines', // 'lines' | 'planes'
  projection: 'perspective', // 'perspective' | 'orthographic'
  rotating: true,
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

function rebuildShape() {
  shape = buildShape(state.type, state.dim, state.sides)
  baseVertices = shape.vertices
  rotations = makeAutoRotations(state.dim)
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
  const rotated = rotatePoints(baseVertices, rotations)
  const projected = projectTo3D(rotated, state.projection, PROJECT_DISTANCE)
  activeRenderer.update(projected)
}

// ---------------------------------------------------------------------------
// UI panel
// ---------------------------------------------------------------------------
const panel = createPanel({
  shapes: SHAPES,
  state,
  limits: { DIM_MIN, DIM_MAX, SIDES_MIN, SIDES_MAX },
  onShape: (value) => {
    state.type = value
    rebuildShape()
  },
  onDim: (value) => {
    state.dim = clamp(value, DIM_MIN, DIM_MAX)
    rebuildShape()
  },
  onSides: (value) => {
    state.sides = clamp(value, SIDES_MIN, SIDES_MAX)
    rebuildShape()
  },
  onMode: (mode) => applyMode(mode),
  onProjection: (projection) => {
    state.projection = projection
    projectAndUpdate()
  },
  onRotateToggle: (on) => {
    state.rotating = on
  },
})
document.getElementById('ui').appendChild(panel.el)

function clamp(value, lo, hi) {
  return Math.max(lo, Math.min(hi, value))
}

// ---------------------------------------------------------------------------
// Render loop — throttled to 60fps
// ---------------------------------------------------------------------------
const fps = new FpsMeter()
// Cap at ~60fps. The threshold sits a hair below a true 60Hz frame (1000/62)
// so a real 60Hz display never beat-frequency-skips a jittery frame, while
// 120/144Hz displays are still throttled down. The modulo accumulator on
// lastFrame keeps the long-run average pinned to the cap.
const FRAME_MS = 1000 / 62
let lastFrame = performance.now()

function loop(now) {
  requestAnimationFrame(loop)

  const elapsed = now - lastFrame
  if (elapsed < FRAME_MS) return
  lastFrame = now - (elapsed % FRAME_MS)

  if (state.rotating) {
    advanceRotations(rotations, elapsed / 1000)
    projectAndUpdate()
  }

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
