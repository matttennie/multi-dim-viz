import { performance } from 'node:perf_hooks'

import { buildShape, countTriangles, SHAPES, shapeLimits } from '../src/geometry/shapes.js'
import { advanceRotations, makeAutoRotations, projectTo3D, rotatePoints } from '../src/math/ndmath.js'

const frames = Number(process.argv[2] || 240)
const projection = 'perspective'
let slowest = null

for (const shapeMeta of SHAPES) {
  const lim = shapeLimits(shapeMeta.value)
  const shape = buildShape(shapeMeta.value, lim.dimMax, lim.sidesMax)
  const rotations = makeAutoRotations(shape.dim)
  const start = performance.now()

  for (let frame = 0; frame < frames; frame++) {
    advanceRotations(rotations, 1 / 60)
    const rotated = rotatePoints(shape.vertices, rotations)
    projectTo3D(rotated, projection, 3)
  }

  const elapsedMs = performance.now() - start
  const msPerFrame = elapsedMs / frames
  const row = {
    shape: shapeMeta.value,
    dim: shape.dim,
    sides: lim.sidesMax,
    vertices: shape.vertices.length,
    triangles: countTriangles(shape.faces),
    msPerFrame: Number(msPerFrame.toFixed(3)),
    cpuFps: Number((1000 / msPerFrame).toFixed(1)),
  }
  if (!slowest || row.msPerFrame > slowest.msPerFrame) slowest = row
  console.log(JSON.stringify(row))
}

console.log(`slowest=${JSON.stringify(slowest)}`)
