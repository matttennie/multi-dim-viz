import { describe, expect, it } from 'vitest'

import {
  buildShape,
  countTriangles,
  GEOMETRY_LIMITS,
  SHAPES,
  shapeLimits,
} from '../src/geometry/shapes.js'
import { makeAutoRotations, projectTo3D, rotatePoints } from '../src/math/ndmath.js'

function unique(values) {
  return [...new Set(values)]
}

function assertInvariant(condition, message) {
  if (!condition) throw new Error(message)
}

describe('shape generation contracts', () => {
  it('keeps every public control setting inside geometry budgets', () => {
    for (const shapeMeta of SHAPES) {
      const lim = shapeLimits(shapeMeta.value)
      const dims = unique([
        lim.dimMin,
        lim.dimMax,
        Math.floor((lim.dimMin + lim.dimMax) / 2),
      ])
      const sidesValues = unique([
        lim.sidesMin,
        lim.sidesMax,
        Math.floor((lim.sidesMin + lim.sidesMax) / 2),
      ])

      for (const dim of dims) {
        for (const sides of sidesValues) {
          const shape = buildShape(shapeMeta.value, dim, sides)
          const triangles = countTriangles(shape.faces)

          expect(shape.vertices.length, `${shapeMeta.value} ${dim}D vertices`).toBeLessThanOrEqual(
            GEOMETRY_LIMITS.maxVertices,
          )
          expect(triangles, `${shapeMeta.value} ${dim}D triangles`).toBeLessThanOrEqual(
            GEOMETRY_LIMITS.maxTriangles,
          )
        }
      }
    }
  })

  it('produces finite, internally consistent geometry and projections', () => {
    for (const shapeMeta of SHAPES) {
      const lim = shapeLimits(shapeMeta.value)
      const shape = buildShape(shapeMeta.value, lim.dimMax, lim.sidesMax)

      assertInvariant(shape.dim >= lim.dimMin, `${shapeMeta.value}: dim below min`)
      assertInvariant(shape.dim <= lim.dimMax, `${shapeMeta.value}: dim above max`)
      assertInvariant(shape.vertices.length > 0, `${shapeMeta.value}: no vertices`)

      for (const vertex of shape.vertices) {
        assertInvariant(vertex.length === shape.dim, `${shapeMeta.value}: bad vertex dimension`)
        assertInvariant(vertex.every(Number.isFinite), `${shapeMeta.value}: non-finite vertex`)
      }

      for (const [a, b] of shape.edges) {
        assertInvariant(a >= 0 && b >= 0, `${shapeMeta.value}: negative edge index`)
        assertInvariant(
          a < shape.vertices.length && b < shape.vertices.length,
          `${shapeMeta.value}: edge index out of range`,
        )
        assertInvariant(a !== b, `${shapeMeta.value}: self edge`)
      }

      for (const face of shape.faces) {
        assertInvariant(face.length >= 3, `${shapeMeta.value}: degenerate face`)
        for (const index of face) {
          assertInvariant(
            index >= 0 && index < shape.vertices.length,
            `${shapeMeta.value}: face index out of range`,
          )
        }
      }

      const rotated = rotatePoints(shape.vertices, makeAutoRotations(shape.dim))
      const projected = projectTo3D(rotated, 'perspective', 3)
      assertInvariant(
        projected.length === shape.vertices.length,
        `${shapeMeta.value}: projection length mismatch`,
      )
      for (const point of projected) {
        assertInvariant(point.length === 3, `${shapeMeta.value}: projection not 3D`)
        assertInvariant(point.every(Number.isFinite), `${shapeMeta.value}: non-finite projection`)
      }
    }
  })

  it('clamps invalid public inputs into per-shape limits', () => {
    const torus = buildShape('torus', -100, 999)
    expect(torus.dim).toBe(shapeLimits('torus').dimMin)
    expect(torus.vertices.length).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxVertices)
    expect(countTriangles(torus.faces)).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxTriangles)

    const prism = buildShape('prism', 999, 999)
    expect(prism.dim).toBe(shapeLimits('prism').dimMax)
    expect(prism.vertices.length).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxVertices)
    expect(countTriangles(prism.faces)).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxTriangles)
  })

  it('models user-facing side counts as mathematical limits, not tessellation', () => {
    for (const shapeMeta of SHAPES) {
      const lim = shapeLimits(shapeMeta.value)
      expect(lim.sidesMax).toBeLessThanOrEqual(GEOMETRY_LIMITS.sidesMax)
    }

    expect(shapeLimits('mobius')).toMatchObject({
      usesSides: false,
      dimMin: 3,
      dimMax: 3,
      sidesMin: 1,
      sidesMax: 1,
    })
    expect(shapeLimits('torus')).toMatchObject({
      usesSides: false,
      dimMin: 2,
      sidesMin: 2,
      sidesMax: 2,
    })
    expect(shapeLimits('sphere')).toMatchObject({
      usesSides: false,
      sidesMin: 2,
      sidesMax: 2,
    })
    expect(shapeLimits('prism')).toMatchObject({
      usesSides: true,
      sidesMin: GEOMETRY_LIMITS.sidesMin,
      sidesMax: GEOMETRY_LIMITS.sidesMax,
    })
  })
})
