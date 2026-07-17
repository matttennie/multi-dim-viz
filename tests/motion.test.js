import { describe, expect, it } from 'vitest'

import { makeAutoRotations } from '../src/math/ndmath.js'
import { applyShapeChange } from '../src/math/motion.js'

describe('auto-rotation plane ownership', () => {
  it('emits only depth-like planes, never touching x or y (regression: read as spin with Rotate off)', () => {
    // Rotating x or y through a hidden axis projects as a turntable turn
    // about the vertical/horizontal axis — that is Rotate's job, not morph.
    for (let dim = 1; dim <= 8; dim++) {
      for (const { i, j } of makeAutoRotations(dim)) {
        expect(i, `dim ${dim}`).toBeGreaterThanOrEqual(2)
        expect(j, `dim ${dim}`).toBeGreaterThan(i)
        expect(j, `dim ${dim}`).toBeLessThan(dim)
      }
    }
  })

  it('includes the classic z-w "inside-out" plane at dim 4 (regression: 4D morph was dead)', () => {
    expect(makeAutoRotations(4)).toEqual([
      expect.objectContaining({ i: 2, j: 3 }),
    ])
  })

  it('provides at least one morph plane in every dim above 3', () => {
    for (let dim = 4; dim <= 8; dim++) {
      expect(makeAutoRotations(dim).length, `dim ${dim}`).toBeGreaterThan(0)
    }
  })

  it('provides no planes at dim 3 and below (nothing hidden to morph)', () => {
    for (let dim = 1; dim <= 3; dim++) {
      expect(makeAutoRotations(dim), `dim ${dim}`).toEqual([])
    }
  })

  it('gives every plane a distinct positive speed so the morph does not visibly repeat', () => {
    const speeds = makeAutoRotations(8).map((r) => r.speed)
    expect(new Set(speeds).size).toBe(speeds.length)
    for (const s of speeds) expect(s).toBeGreaterThan(0)
  })
})

describe('shape change deformation', () => {
  const verts4d = [
    [0.5, -0.2, 0.3, 0.8],
    [1, 0, 0, -0.6],
  ]

  it('is the identity when disabled, even mid-phase (regression: toggle-off froze a distorted shape)', () => {
    const out = applyShapeChange(verts4d, 2.37, false)
    expect(out).toEqual(verts4d)
  })

  it('perturbs only hidden coordinates when enabled', () => {
    const out = applyShapeChange(verts4d, 1.0, true)
    expect(out[0].slice(0, 3)).toEqual([0.5, -0.2, 0.3])
    expect(out[1].slice(0, 3)).toEqual([1, 0, 0])
    expect(out[0][3]).not.toBe(0.8)
    expect(out[1][3]).not.toBe(-0.6)
  })

  it('never mutates the input vertices', () => {
    const input = [[0.1, 0.2, 0.3, 0.4, 0.5]]
    const snapshot = JSON.parse(JSON.stringify(input))
    applyShapeChange(input, 1.7, true)
    expect(input).toEqual(snapshot)
  })

  it('is the identity for 3D and lower vertices', () => {
    const verts3d = [
      [0.5, -0.2, 0.3],
      [1, 0],
    ]
    expect(applyShapeChange(verts3d, 1.0, true)).toEqual(verts3d)
  })

  it('produces finite output across phases', () => {
    for (let phase = 0; phase < 10; phase += 0.7) {
      const out = applyShapeChange(verts4d, phase, true)
      for (const p of out) {
        expect(p.every(Number.isFinite)).toBe(true)
      }
    }
  })
})
