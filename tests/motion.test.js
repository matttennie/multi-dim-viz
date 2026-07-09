import { describe, expect, it } from 'vitest'

import { makeAutoRotations } from '../src/math/ndmath.js'
import { applyShapeChange, isShapeChangeRotation } from '../src/math/motion.js'

describe('motion plane ownership', () => {
  it('classifies the z-hidden plane as shape change (regression: 4D morph was dead)', () => {
    // The classic 4D "inside-out" morph is the (2,3) rotation: z through w.
    expect(isShapeChangeRotation({ i: 2, j: 3 })).toBe(true)
  })

  it('classifies hidden-hidden planes as shape change', () => {
    expect(isShapeChangeRotation({ i: 3, j: 4 })).toBe(true)
    expect(isShapeChangeRotation({ i: 5, j: 7 })).toBe(true)
  })

  it('excludes planes touching x or y (regression: read as spin with Rotate off)', () => {
    // Rotating x or y through a hidden axis projects as a turntable turn
    // about the vertical/horizontal axis — that is Rotate's job, not morph.
    expect(isShapeChangeRotation({ i: 0, j: 3 })).toBe(false)
    expect(isShapeChangeRotation({ i: 1, j: 3 })).toBe(false)
    expect(isShapeChangeRotation({ i: 0, j: 7 })).toBe(false)
  })

  it('keeps purely visible planes out of shape change', () => {
    expect(isShapeChangeRotation({ i: 0, j: 1 })).toBe(false)
    expect(isShapeChangeRotation({ i: 1, j: 2 })).toBe(false)
    expect(isShapeChangeRotation({ i: 0, j: 2 })).toBe(false)
  })

  it('gives shape change at least one auto-rotation plane in every dim above 3', () => {
    for (let dim = 4; dim <= 8; dim++) {
      const owned = makeAutoRotations(dim).filter(isShapeChangeRotation)
      expect(owned.length, `dim ${dim}`).toBeGreaterThan(0)
    }
  })

  it('gives shape change no planes at dim 3 and below (nothing hidden to morph)', () => {
    for (let dim = 2; dim <= 3; dim++) {
      const owned = makeAutoRotations(dim).filter(isShapeChangeRotation)
      expect(owned.length, `dim ${dim}`).toBe(0)
    }
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
