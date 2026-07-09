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

      expect(shape.dim).toBeGreaterThanOrEqual(lim.dimMin)
      expect(shape.dim).toBeLessThanOrEqual(lim.dimMax)
      expect(shape.vertices.length).toBeGreaterThan(0)

      for (const vertex of shape.vertices) {
        expect(vertex).toHaveLength(shape.dim)
        expect(vertex.every(Number.isFinite)).toBe(true)
      }

      for (const [a, b] of shape.edges) {
        expect(a).toBeGreaterThanOrEqual(0)
        expect(b).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThan(shape.vertices.length)
        expect(b).toBeLessThan(shape.vertices.length)
        expect(a).not.toBe(b)
      }

      for (const face of shape.faces) {
        expect(face.length).toBeGreaterThanOrEqual(3)
        for (const index of face) {
          expect(index).toBeGreaterThanOrEqual(0)
          expect(index).toBeLessThan(shape.vertices.length)
        }
      }

      const rotated = rotatePoints(shape.vertices, makeAutoRotations(shape.dim))
      const projected = projectTo3D(rotated, 'perspective', 3)
      expect(projected).toHaveLength(shape.vertices.length)
      for (const point of projected) {
        expect(point).toHaveLength(3)
        expect(point.every(Number.isFinite)).toBe(true)
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
})
