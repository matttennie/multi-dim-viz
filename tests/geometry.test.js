import { describe, expect, it } from 'vitest'

import {
  buildShape,
  countTriangles,
  GEOMETRY_LIMITS,
  SHAPES,
  shapeLimits,
} from '../src/geometry/shapes.js'
import {
  makeAutoRotations,
  projectTo3D,
  rotatePoints,
} from '../src/math/ndmath.js'

function unique(values) {
  return [...new Set(values)]
}

function assertInvariant(condition, message) {
  expect(condition, message).toBe(true)
}

function distance(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2
  return Math.sqrt(s)
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

          expect(
            shape.vertices.length,
            `${shapeMeta.value} ${dim}D vertices`,
          ).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxVertices)
          expect(
            triangles,
            `${shapeMeta.value} ${dim}D triangles`,
          ).toBeLessThanOrEqual(GEOMETRY_LIMITS.maxTriangles)
        }
      }
    }
  })

  it('produces finite, internally consistent geometry and projections', () => {
    for (const shapeMeta of SHAPES) {
      const lim = shapeLimits(shapeMeta.value)
      const shape = buildShape(shapeMeta.value, lim.dimMax, lim.sidesMax)

      assertInvariant(
        shape.dim >= lim.dimMin,
        `${shapeMeta.value}: dim below min`,
      )
      assertInvariant(
        shape.dim <= lim.dimMax,
        `${shapeMeta.value}: dim above max`,
      )
      assertInvariant(
        shape.vertices.length > 0,
        `${shapeMeta.value}: no vertices`,
      )

      for (const vertex of shape.vertices) {
        assertInvariant(
          vertex.length === shape.dim,
          `${shapeMeta.value}: bad vertex dimension`,
        )
        assertInvariant(
          vertex.every(Number.isFinite),
          `${shapeMeta.value}: non-finite vertex`,
        )
      }

      for (const [a, b] of shape.edges) {
        assertInvariant(
          a >= 0 && b >= 0,
          `${shapeMeta.value}: negative edge index`,
        )
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
        assertInvariant(
          point.length === 3,
          `${shapeMeta.value}: projection not 3D`,
        )
        assertInvariant(
          point.every(Number.isFinite),
          `${shapeMeta.value}: non-finite projection`,
        )
      }
    }
  })

  it('clamps invalid public inputs into per-shape limits', () => {
    const torus = buildShape('torus', -100, 999)
    expect(torus.dim).toBe(shapeLimits('torus').dimMin)
    expect(torus.vertices.length).toBeLessThanOrEqual(
      GEOMETRY_LIMITS.maxVertices,
    )
    expect(countTriangles(torus.faces)).toBeLessThanOrEqual(
      GEOMETRY_LIMITS.maxTriangles,
    )

    const prism = buildShape('prism', 999, 999)
    expect(prism.dim).toBe(shapeLimits('prism').dimMax)
    expect(prism.vertices.length).toBeLessThanOrEqual(
      GEOMETRY_LIMITS.maxVertices,
    )
    expect(countTriangles(prism.faces)).toBeLessThanOrEqual(
      GEOMETRY_LIMITS.maxTriangles,
    )
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

// The closed-form checks below are what make this suite trustworthy for a
// math-teaching tool: wrong-but-finite geometry (a sign flip, a missing face
// family) passes every budget/finiteness test but fails these.
describe('mathematical structure', () => {
  it('hypercube has 2^n vertices, n·2^(n-1) edges, C(n,2)·2^(n-2) square faces', () => {
    for (let dim = 2; dim <= 8; dim++) {
      const s = buildShape('hypercube', dim, 0)
      expect(s.vertices.length, `${dim}D vertices`).toBe(2 ** dim)
      expect(s.edges.length, `${dim}D edges`).toBe(dim * 2 ** (dim - 1))
      expect(s.faces.length, `${dim}D faces`).toBe(
        ((dim * (dim - 1)) / 2) * 2 ** (dim - 2),
      )
    }
  })

  it('simplex has n+1 vertices, C(n+1,2) edges of equal length, C(n+1,3) faces', () => {
    for (let dim = 2; dim <= 8; dim++) {
      const s = buildShape('simplex', dim, 0)
      const n = dim + 1
      expect(s.vertices.length, `${dim}D vertices`).toBe(n)
      expect(s.edges.length, `${dim}D edges`).toBe((n * (n - 1)) / 2)
      expect(s.faces.length, `${dim}D faces`).toBe((n * (n - 1) * (n - 2)) / 6)
      // Regularity: every pairwise distance equal (the apex construction).
      const first = distance(s.vertices[0], s.vertices[1])
      for (const [a, b] of s.edges) {
        expect(
          distance(s.vertices[a], s.vertices[b]),
          `${dim}D edge ${a}-${b}`,
        ).toBeCloseTo(first, 10)
      }
    }
  })

  it('cross-polytope has 2n vertices and 2n(n-1) edges', () => {
    for (let dim = 2; dim <= 8; dim++) {
      const s = buildShape('crossPolytope', dim, 0)
      expect(s.vertices.length, `${dim}D vertices`).toBe(2 * dim)
      expect(s.edges.length, `${dim}D edges`).toBe(2 * dim * (dim - 1))
    }
  })

  it('rotates e_i onto e_j by a quarter turn in plane (i,j)', () => {
    const e1 = [0, 1, 0, 0]
    const [r] = rotatePoints(
      [e1],
      [{ i: 1, j: 3, angle: Math.PI / 2, speed: 0 }],
    )
    expect(r[0]).toBeCloseTo(0, 12)
    expect(r[1]).toBeCloseTo(0, 12)
    expect(r[2]).toBeCloseTo(0, 12)
    expect(r[3]).toBeCloseTo(1, 12)
  })

  it('matches a hand-computed perspective projection of a 4D point', () => {
    // Collapsing x3 = 1 at distance 3 scales the rest by 3 / (3 - 1) = 1.5.
    const [p] = projectTo3D([[0.2, -0.4, 0.6, 1]], 'perspective', 3)
    expect(p[0]).toBeCloseTo(0.3, 12)
    expect(p[1]).toBeCloseTo(-0.6, 12)
    expect(p[2]).toBeCloseTo(0.9, 12)
  })

  it('centers every shape at the origin and normalizes max radius to 1', () => {
    for (const shapeMeta of SHAPES) {
      const lim = shapeLimits(shapeMeta.value)
      const s = buildShape(shapeMeta.value, lim.dimMax, lim.sidesMax)
      const centroid = new Array(s.dim).fill(0)
      for (const v of s.vertices) {
        for (let i = 0; i < s.dim; i++) centroid[i] += v[i] / s.vertices.length
      }
      for (const c of centroid) {
        expect(Math.abs(c), `${shapeMeta.value} centroid`).toBeLessThan(1e-9)
      }
      const maxR = Math.max(...s.vertices.map((v) => Math.hypot(...v)))
      expect(maxR, `${shapeMeta.value} max radius`).toBeCloseTo(1, 9)
    }
  })

  it('rotatePoints and projectTo3D never mutate their input', () => {
    const input = [[0.1, 0.2, 0.3, 0.4]]
    const snapshot = JSON.parse(JSON.stringify(input))
    rotatePoints(input, [{ i: 0, j: 3, angle: 1.3, speed: 0 }])
    projectTo3D(input, 'perspective', 3)
    expect(input).toEqual(snapshot)
  })
})
