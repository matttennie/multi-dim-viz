/**
 * N-dimensional shape geometry.
 *
 * CONTRACT (do not change signatures — main.js depends on them):
 *
 *   SHAPES : Array<{ value:string, label:string, usesSides:boolean }>
 *     Metadata for the dropdown. `usesSides` controls whether the Sides input
 *     is enabled for that shape.
 *
 *   buildShape(type, dim, sides) -> {
 *     vertices : number[][]   // each vertex is a length-`dim` array of coords
 *     edges    : [number,number][]   // index pairs into `vertices`
 *     faces    : number[][]   // each face = ordered list of vertex indices (polygon, length >= 3)
 *     dim      : number
 *   }
 *
 *   Requirements:
 *     - `dim` is an integer in [1, 8]; user-facing `sides` is a mathematical
 *       side count clamped per shape, with a global ceiling of 12. Surface
 *       tessellation is fixed internally so it is not confused with side count.
 *     - Vertices MUST be centered at the origin and normalized so the maximum
 *       distance of any vertex from the origin is ~1.0 (so every shape/dim fits
 *       the same view). Use a single uniform scale factor (don't distort).
 *     - `edges` are used by Lines mode; `faces` (2-faces / polygons) by Planes mode.
 *     - Keep totals bounded for performance: <= 5000 vertices and <= 20000
 *       triangles after fan-triangulation. For torus/sphere, choose
 *       tessellation so the count stays bounded as dim grows (do NOT take
 *       sides^dim samples).
 *     - Handle low dims gracefully (dim 1 = a segment, dim 2 = a polygon/face).
 *
 *   Shape semantics:
 *     - hypercube     : measure polytope (n-cube). Edges parallel to axes;
 *                       faces are the 2-faces (squares).
 *     - simplex       : regular n-simplex (n+1 vertices). Edges = all vertex
 *                       pairs; faces = all vertex triples (triangles).
 *     - crossPolytope : orthoplex (2n vertices at +/- unit on each axis).
 *                       Edges connect non-antipodal vertices; faces = triangles
 *                       from 3 distinct axes.
 *     - torus         : (generalized) torus surface. Built in 3D and lifted
 *                       into higher dims so the N-D rotation tumbles it
 *                       through the extra axes.
 *     - prism         : n-gon prism (`sides` = polygon sides), extruded through
 *                       the available dimensions.
 *     - sphere        : sphere surface (UV-sampled S²) built in 3D and, like
 *                       the torus, coiled into each higher axis so every
 *                       added dimension genuinely changes the embedding. It
 *                       is NOT an n-sphere — a sampled S^(n-1) blows the
 *                       vertex budget past dim 4.
 */

export const GEOMETRY_LIMITS = Object.freeze({
  dimMin: 1,
  dimMax: 8,
  noSides: 0,
  surfaceSegments: 12,
  sidesMin: 3,
  sidesMax: 12,
  maxVertices: 5000,
  maxTriangles: 20000,
})

// Each shape carries its own valid parameter ranges. The UI steppers and the
// buildShape() clamp both read these, so a shape can never be driven outside the
// range where it's geometrically meaningful (e.g. a Möbius strip needs >= 3
// dimensions for its half-twist; a prism's polygon needs >= 3 sides).
export const SHAPES = [
  {
    value: 'hypercube',
    label: 'Hypercube',
    usesSides: false,
    dimMin: GEOMETRY_LIMITS.dimMin,
    dimMax: GEOMETRY_LIMITS.dimMax,
    sidesMin: GEOMETRY_LIMITS.noSides,
    sidesMax: GEOMETRY_LIMITS.noSides,
  },
  {
    value: 'simplex',
    label: 'Simplex',
    usesSides: false,
    dimMin: GEOMETRY_LIMITS.dimMin,
    dimMax: GEOMETRY_LIMITS.dimMax,
    sidesMin: GEOMETRY_LIMITS.noSides,
    sidesMax: GEOMETRY_LIMITS.noSides,
  },
  {
    value: 'crossPolytope',
    label: 'Cross-Polytope',
    usesSides: false,
    dimMin: GEOMETRY_LIMITS.dimMin,
    dimMax: GEOMETRY_LIMITS.dimMax,
    sidesMin: GEOMETRY_LIMITS.noSides,
    sidesMax: GEOMETRY_LIMITS.noSides,
  },
  {
    value: 'torus',
    label: 'Torus',
    usesSides: false,
    dimMin: 2,
    dimMax: GEOMETRY_LIMITS.dimMax,
    sidesMin: 2,
    sidesMax: 2,
  },
  {
    value: 'mobius',
    label: 'Möbius Strip',
    usesSides: false,
    dimMin: 3,
    dimMax: 3,
    sidesMin: 1,
    sidesMax: 1,
  },
  {
    value: 'prism',
    label: 'N-gon Prism',
    usesSides: true,
    dimMin: 2,
    dimMax: GEOMETRY_LIMITS.dimMax,
    sidesMin: GEOMETRY_LIMITS.sidesMin,
    sidesMax: GEOMETRY_LIMITS.sidesMax,
  },
  {
    value: 'sphere',
    label: 'Sphere',
    usesSides: false,
    dimMin: 2,
    dimMax: GEOMETRY_LIMITS.dimMax,
    sidesMin: 2,
    sidesMax: 2,
  },
]

/** Valid parameter ranges for a shape (falls back to the first shape). */
export function shapeLimits(type) {
  const s = SHAPES.find((x) => x.value === type) || SHAPES[0]
  return {
    usesSides: s.usesSides,
    dimMin: s.dimMin,
    dimMax: s.dimMax,
    sidesMin: s.sidesMin,
    sidesMax: s.sidesMax,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a length-`dim` zero vector. */
function zeros(dim) {
  return new Array(dim).fill(0)
}

/**
 * Center vertices at the origin (subtract centroid) then scale ALL of them by a
 * single uniform factor so the largest distance from the origin is ~1.0.
 * Returns the final result object.
 */
function finalize(vertices, edges, faces, dim) {
  assertGeometryBudget(vertices, faces)
  const n = vertices.length
  if (n > 0) {
    // Centroid.
    const c = zeros(dim)
    for (const v of vertices) {
      for (let i = 0; i < dim; i++) c[i] += v[i]
    }
    for (let i = 0; i < dim; i++) c[i] /= n
    // Subtract centroid.
    for (const v of vertices) {
      for (let i = 0; i < dim; i++) v[i] -= c[i]
    }
    // Largest radius.
    let maxSq = 0
    for (const v of vertices) {
      let s = 0
      for (let i = 0; i < dim; i++) s += v[i] * v[i]
      if (s > maxSq) maxSq = s
    }
    const maxR = Math.sqrt(maxSq)
    if (maxR > 1e-12) {
      const inv = 1 / maxR
      for (const v of vertices) {
        for (let i = 0; i < dim; i++) v[i] *= inv
      }
    }
  }
  return { vertices, edges, faces, dim }
}

export function countTriangles(faces) {
  let total = 0
  for (const face of faces) total += Math.max(0, face.length - 2)
  return total
}

function assertGeometryBudget(vertices, faces) {
  const triangleCount = countTriangles(faces)
  if (
    vertices.length > GEOMETRY_LIMITS.maxVertices ||
    triangleCount > GEOMETRY_LIMITS.maxTriangles
  ) {
    throw new Error(
      `Geometry budget exceeded: ${vertices.length} vertices, ${triangleCount} triangles`,
    )
  }
}

/** A unit segment on axis 0 (used for dim === 1 across all shapes). */
function segment(dim) {
  const a = zeros(dim)
  const b = zeros(dim)
  a[0] = -1
  b[0] = 1
  return { vertices: [a, b], edges: [[0, 1]], faces: [], dim }
}

/**
 * A flat regular `sides`-gon ring in dims 0,1 (radius 1). Returns vertices plus
 * the ring edges and the single perimeter face. Used for dim === 2 of several
 * shapes.
 */
function polygonRing(dim, sides) {
  const vertices = []
  const edges = []
  const face = []
  for (let k = 0; k < sides; k++) {
    const v = zeros(dim)
    const a = (2 * Math.PI * k) / sides
    v[0] = Math.cos(a)
    v[1] = Math.sin(a)
    vertices.push(v)
    edges.push([k, (k + 1) % sides])
    face.push(k)
  }
  return { vertices, edges, faces: [face], dim }
}

// ---------------------------------------------------------------------------
// hypercube
// ---------------------------------------------------------------------------

function buildHypercube(dim) {
  const count = 1 << dim // 2^dim
  const vertices = []
  for (let m = 0; m < count; m++) {
    const v = zeros(dim)
    for (let k = 0; k < dim; k++) v[k] = (m >> k) & 1 ? 1 : -1
    vertices.push(v)
  }

  // Edges: vertices differing in exactly one coordinate.
  const edges = []
  for (let m = 0; m < count; m++) {
    for (let k = 0; k < dim; k++) {
      const nb = m ^ (1 << k)
      if (m < nb) edges.push([m, nb])
    }
  }

  // Faces: 2-faces (squares). For every axis pair (a,b) and every assignment of
  // the remaining dim-2 coordinates, the 4 corners form a square cycle:
  // (a-,b-),(a+,b-),(a+,b+),(a-,b+).
  const faces = []
  for (let a = 0; a < dim; a++) {
    for (let b = a + 1; b < dim; b++) {
      const restCount = 1 << (dim - 2)
      for (let rest = 0; rest < restCount; rest++) {
        // Spread `rest` bits into the axes that are not a or b.
        let base = 0
        let bit = 0
        for (let k = 0; k < dim; k++) {
          if (k === a || k === b) continue
          if ((rest >> bit) & 1) base |= 1 << k
          bit++
        }
        const A = 1 << a
        const B = 1 << b
        faces.push([base, base | A, base | A | B, base | B])
      }
    }
  }

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// simplex
// ---------------------------------------------------------------------------

function buildSimplex(dim) {
  // dim standard basis vectors + one apex, then center & normalize.
  const n = dim + 1
  const vertices = []
  for (let i = 0; i < dim; i++) {
    const v = zeros(dim)
    v[i] = 1
    vertices.push(v)
  }
  const c = (1 - Math.sqrt(dim + 1)) / dim
  const apex = zeros(dim)
  for (let i = 0; i < dim; i++) apex[i] = c
  vertices.push(apex)

  // Edges: all vertex pairs.
  const edges = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) edges.push([i, j])
  }

  // Faces: all vertex triples (triangles).
  const faces = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) faces.push([i, j, k])
    }
  }

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// crossPolytope
// ---------------------------------------------------------------------------

function buildCrossPolytope(dim) {
  // Vertices: +/- e_i. Index 2*i = +e_i, 2*i+1 = -e_i.
  const vertices = []
  for (let i = 0; i < dim; i++) {
    const p = zeros(dim)
    p[i] = 1
    vertices.push(p)
    const m = zeros(dim)
    m[i] = -1
    vertices.push(m)
  }

  // Edges: every pair except antipodal (same axis) pairs.
  const total = 2 * dim
  const edges = []
  for (let p = 0; p < total; p++) {
    for (let q = p + 1; q < total; q++) {
      if ((p >> 1) === (q >> 1)) continue // same axis => antipodal
      edges.push([p, q])
    }
  }

  // Faces: triangles from every choice of 3 distinct axes and every sign combo.
  const faces = []
  for (let a = 0; a < dim; a++) {
    for (let b = a + 1; b < dim; b++) {
      for (let c = b + 1; c < dim; c++) {
        for (let s = 0; s < 8; s++) {
          const va = 2 * a + (s & 1 ? 1 : 0)
          const vb = 2 * b + (s & 2 ? 1 : 0)
          const vc = 2 * c + (s & 4 ? 1 : 0)
          faces.push([va, vb, vc])
        }
      }
    }
  }

  // dim 2 has no 3-axis triangle but is a genuine flat polygon (a diamond);
  // give it its single perimeter face: +e0, +e1, -e0, -e1.
  if (dim === 2) faces.push([0, 2, 1, 3])

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// torus
// ---------------------------------------------------------------------------

function buildTorus(dim) {
  const segments = GEOMETRY_LIMITS.surfaceSegments

  // dim 2: a flat circle ring (needs >= 3 points to read as a ring).
  if (dim === 2) {
    const ring = polygonRing(dim, segments)
    return finalize(ring.vertices, ring.edges, ring.faces, dim)
  }

  // dim >= 3: a torus SURFACE (2-manifold) built as a round donut in dims 0,1,2,
  // then coiled into each higher dimension with its own winding harmonic. dim 3
  // is the clean donut (no extra windings); every added dimension adds a finer
  // coil, so the shape genuinely changes at EVERY dimension. Crucially it stays
  // a light, low-overdraw shell — unlike a true n-torus (T^n), whose translucent
  // 2-faces self-overlap so heavily they collapse the lit Planes mode.
  //
  // (A genuine n-torus would be a k=floor(dim/2)-fold product of circles; it
  // renders fine as lines but is fragment-bound in transparent Planes mode, so
  // we use this wound 2-torus embedding instead.)
  // Surface tessellation is fixed so it is not confused with the mathematical
  // side-count shown in the UI.
  const nu = segments * 2 // around the main ring
  const nv = segments // around the tube
  const idx = (i, j) => i * nv + j
  const R = 0.6
  const r = 0.3

  const vertices = []
  for (let i = 0; i < nu; i++) {
    const u = (2 * Math.PI * i) / nu
    for (let j = 0; j < nv; j++) {
      const v = (2 * Math.PI * j) / nv
      const tube = R + r * Math.cos(v)
      const p = zeros(dim)
      p[0] = tube * Math.cos(u)
      p[1] = tube * Math.sin(u)
      p[2] = r * Math.sin(v)
      // Coil into each higher axis with an increasing-frequency winding so every
      // added dimension visibly changes the embedding.
      for (let d = 3; d < dim; d++) {
        const h = d - 2 // 1, 2, 3, ...
        const amp = 0.4 / Math.sqrt(h)
        const freq = h + 1
        p[d] =
          d % 2 === 1
            ? amp * Math.sin(freq * u + v)
            : amp * Math.cos(freq * v - u)
      }
      vertices.push(p)
    }
  }

  const edges = []
  const faces = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const i1 = (i + 1) % nu
      const j1 = (j + 1) % nv
      edges.push([idx(i, j), idx(i1, j)])
      edges.push([idx(i, j), idx(i, j1)])
      faces.push([idx(i, j), idx(i1, j), idx(i1, j1), idx(i, j1)])
    }
  }

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// prism
// ---------------------------------------------------------------------------

function buildPrism(dim, sides) {
  // dim 2: just the regular polygon in the plane.
  if (dim === 2) {
    const ring = polygonRing(dim, sides)
    return finalize(ring.vertices, ring.edges, ring.faces, dim)
  }

  // dim >= 3: (sides-gon ring in dims 0,1) x (hypercube corners in dims 2..dim-1).
  const extDim = dim - 2
  const corners = 1 << extDim // 2^(dim-2)
  const idx = (c, k) => c * sides + k

  const vertices = []
  for (let c = 0; c < corners; c++) {
    for (let k = 0; k < sides; k++) {
      const v = zeros(dim)
      const a = (2 * Math.PI * k) / sides
      v[0] = Math.cos(a)
      v[1] = Math.sin(a)
      for (let b = 0; b < extDim; b++) v[2 + b] = (c >> b) & 1 ? 1 : -1
      vertices.push(v)
    }
  }

  const edges = []
  // (a) ring edges inside each corner's copy.
  for (let c = 0; c < corners; c++) {
    for (let k = 0; k < sides; k++) {
      edges.push([idx(c, k), idx(c, (k + 1) % sides)])
    }
  }
  // (b) extrusion edges between corners differing in exactly one bit.
  for (let c = 0; c < corners; c++) {
    for (let b = 0; b < extDim; b++) {
      const c2 = c ^ (1 << b)
      if (c < c2) {
        for (let k = 0; k < sides; k++) edges.push([idx(c, k), idx(c2, k)])
      }
    }
  }

  const faces = []
  // (a) polygon cap at each corner.
  for (let c = 0; c < corners; c++) {
    const cap = []
    for (let k = 0; k < sides; k++) cap.push(idx(c, k))
    faces.push(cap)
  }
  // (b) quad side faces: each ring edge swept across one extrusion axis.
  for (let c = 0; c < corners; c++) {
    for (let b = 0; b < extDim; b++) {
      const c2 = c ^ (1 << b)
      if (c < c2) {
        for (let k = 0; k < sides; k++) {
          const k1 = (k + 1) % sides
          faces.push([idx(c, k), idx(c, k1), idx(c2, k1), idx(c2, k)])
        }
      }
    }
  }

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// sphere
// ---------------------------------------------------------------------------

function buildSphere(dim) {
  const segments = GEOMETRY_LIMITS.surfaceSegments

  // dim 2: a flat circle (disk perimeter) with one face.
  if (dim === 2) {
    const ring = polygonRing(dim, segments)
    return finalize(ring.vertices, ring.edges, ring.faces, dim)
  }

  // dim >= 3: UV sphere in dims 0,1,2, coiled into each higher axis with its
  // own winding harmonic (same approach as the torus) so every added dimension
  // genuinely changes the embedding instead of leaving the extra coordinates
  // at 0. The sin(phi) factor fades each coil to zero at the poles so the
  // surface stays continuous where all longitudes meet.
  const nLon = segments // longitude segments
  const nLat = segments // latitude divisions (poles + (nLat-1) interior rings)

  const vertices = []
  // North pole = index 0.
  const north = zeros(dim)
  north[2] = 1
  vertices.push(north)

  // Interior rings i = 1..nLat-1.
  // ring index helper into the vertex array.
  const ringIdx = (i, j) => 1 + (i - 1) * nLon + (j % nLon)
  for (let i = 1; i <= nLat - 1; i++) {
    const phi = (Math.PI * i) / nLat // polar angle 0..PI
    const sp = Math.sin(phi)
    const cp = Math.cos(phi)
    for (let j = 0; j < nLon; j++) {
      const theta = (2 * Math.PI * j) / nLon
      const v = zeros(dim)
      v[0] = sp * Math.cos(theta)
      v[1] = sp * Math.sin(theta)
      v[2] = cp
      for (let d = 3; d < dim; d++) {
        const h = d - 2 // 1, 2, 3, ...
        const amp = 0.35 / Math.sqrt(h)
        const freq = h + 1
        v[d] =
          amp *
          sp *
          (d % 2 === 1
            ? Math.sin(freq * theta + phi)
            : Math.cos(freq * phi - theta))
      }
      vertices.push(v)
    }
  }

  // South pole = last index.
  const southIdx = vertices.length
  const south = zeros(dim)
  south[2] = -1
  vertices.push(south)

  const edges = []
  // Ring edges (longitude wrap) for each interior ring.
  for (let i = 1; i <= nLat - 1; i++) {
    for (let j = 0; j < nLon; j++) {
      edges.push([ringIdx(i, j), ringIdx(i, (j + 1) % nLon)])
    }
  }
  // Edges between adjacent interior rings.
  for (let i = 1; i <= nLat - 2; i++) {
    for (let j = 0; j < nLon; j++) {
      edges.push([ringIdx(i, j), ringIdx(i + 1, j)])
    }
  }
  // Pole connections.
  for (let j = 0; j < nLon; j++) {
    edges.push([0, ringIdx(1, j)])
    edges.push([southIdx, ringIdx(nLat - 1, j)])
  }

  const faces = []
  // Top cap triangles.
  for (let j = 0; j < nLon; j++) {
    faces.push([0, ringIdx(1, j), ringIdx(1, (j + 1) % nLon)])
  }
  // Band quads between interior rings.
  for (let i = 1; i <= nLat - 2; i++) {
    for (let j = 0; j < nLon; j++) {
      const j1 = (j + 1) % nLon
      faces.push([ringIdx(i, j), ringIdx(i, j1), ringIdx(i + 1, j1), ringIdx(i + 1, j)])
    }
  }
  // Bottom cap triangles.
  for (let j = 0; j < nLon; j++) {
    const j1 = (j + 1) % nLon
    faces.push([southIdx, ringIdx(nLat - 1, j1), ringIdx(nLat - 1, j)])
  }

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// mobius (Möbius strip)
// ---------------------------------------------------------------------------

function buildMobius(dim) {
  const segments = GEOMETRY_LIMITS.surfaceSegments

  // A Möbius strip needs a third dimension to take its half-twist, so for
  // dim 2 we fall back to a flat ring.
  if (dim === 2) {
    const ring = polygonRing(dim, segments)
    return finalize(ring.vertices, ring.edges, ring.faces, dim)
  }

  // Built in dims 0,1,2 (higher dims left at 0 so it tumbles through them under
  // N-D rotation). Like the torus, we floor the loop resolution so it always
  // reads as a smooth band. Surface tessellation is fixed so it is not confused
  // with the Möbius strip's mathematical one-sidedness.
  const nu = segments * 4 // segments around the loop
  const nv = 6 // segments across the width (nv + 1 points)
  const R = 0.7 // loop radius
  const w = 0.32 // half-width of the band

  const widthPts = nv + 1
  const vid = (i, j) => i * widthPts + j

  const vertices = []
  for (let i = 0; i < nu; i++) {
    const t = (2 * Math.PI * i) / nu
    const ct = Math.cos(t)
    const st = Math.sin(t)
    const cHalf = Math.cos(t / 2)
    const sHalf = Math.sin(t / 2)
    for (let j = 0; j <= nv; j++) {
      const s = (j / nv - 0.5) * 2 * w // across the band, -w .. +w
      const rad = R + s * cHalf
      const p = zeros(dim)
      p[0] = rad * ct
      p[1] = rad * st
      p[2] = s * sHalf
      vertices.push(p)
    }
  }

  // Stepping past the last loop segment returns to the start with the width
  // flipped (j -> nv - j) — this seam is what makes the strip one-sided.
  const nextLoop = (i, j) => (i + 1 < nu ? vid(i + 1, j) : vid(0, nv - j))

  const edges = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j <= nv; j++) {
      edges.push([vid(i, j), nextLoop(i, j)]) // along the loop (flips at seam)
      if (j < nv) edges.push([vid(i, j), vid(i, j + 1)]) // across the width
    }
  }

  const faces = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      faces.push([
        vid(i, j),
        nextLoop(i, j),
        nextLoop(i, j + 1),
        vid(i, j + 1),
      ])
    }
  }

  return finalize(vertices, edges, faces, dim)
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function buildShape(type, dim, sides) {
  // Clamp inputs to THIS shape's valid range (defensive — the UI already keeps
  // them in range, but a shape must never receive degenerate parameters).
  const lim = shapeLimits(type)

  dim = Math.round(Number(dim))
  if (!Number.isFinite(dim)) dim = lim.dimMin
  dim = Math.max(lim.dimMin, Math.min(lim.dimMax, dim))

  sides = Math.round(Number(sides))
  if (!Number.isFinite(sides)) sides = lim.sidesMin
  sides = Math.max(lim.sidesMin, Math.min(lim.sidesMax, sides))

  // dim 1 is a segment (only the polytopes allow dim 1).
  if (dim === 1) return segment(dim)

  switch (type) {
    case 'hypercube':
      return buildHypercube(dim)
    case 'simplex':
      return buildSimplex(dim)
    case 'crossPolytope':
      return buildCrossPolytope(dim)
    case 'torus':
      return buildTorus(dim)
    case 'mobius':
      return buildMobius(dim)
    case 'prism':
      return buildPrism(dim, sides)
    case 'sphere':
      return buildSphere(dim)
    default:
      return buildHypercube(dim)
  }
}
