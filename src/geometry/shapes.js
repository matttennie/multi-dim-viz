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
 *     - `dim` is an integer in [1, 8]; `sides` an integer in [3, 24].
 *     - Vertices MUST be centered at the origin and normalized so the maximum
 *       distance of any vertex from the origin is ~1.0 (so every shape/dim fits
 *       the same view). Use a single uniform scale factor (don't distort).
 *     - `edges` are used by Lines mode; `faces` (2-faces / polygons) by Planes mode.
 *     - Keep totals bounded for performance: aim for <= ~5000 vertices and
 *       <= ~20000 triangles after fan-triangulation. For torus/sphere, choose
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
 *     - torus         : (generalized) torus surface, `sides` controls the ring
 *                       resolution. Built in 3D and lifted into higher dims so
 *                       the N-D rotation tumbles it through the extra axes.
 *     - prism         : n-gon prism (`sides` = polygon sides), extruded through
 *                       the available dimensions.
 *     - sphere        : sphere / hypersphere surface sampled with `sides`
 *                       controlling resolution; lifted/tessellated for the dim.
 */

export const SHAPES = [
  { value: 'hypercube', label: 'Hypercube', usesSides: false },
  { value: 'simplex', label: 'Simplex', usesSides: false },
  { value: 'crossPolytope', label: 'Cross-Polytope', usesSides: false },
  { value: 'torus', label: 'Torus', usesSides: true },
  { value: 'prism', label: 'N-gon Prism', usesSides: true },
  { value: 'sphere', label: 'Sphere / Hypersphere', usesSides: true },
]

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

function buildTorus(dim, sides) {
  // dim 2: a flat circle ring.
  if (dim === 2) {
    const ring = polygonRing(dim, sides)
    return finalize(ring.vertices, ring.edges, ring.faces, dim)
  }

  // A torus is a curved surface, so it should read as ROUND, not faceted. We
  // floor the segment counts well above `sides` so even a low Sides setting
  // gives a smooth donut; `sides` still nudges the detail upward. nu = segments
  // around the main ring (the hole), nv = segments around the tube.
  const nu = Math.min(Math.max(sides * 2, 36), 64)
  const nv = Math.min(Math.max(sides, 18), 32)
  const idx = (i, j) => i * nv + j
  const vertices = []

  if (dim === 3) {
    // Standard donut.
    const R = 0.66
    const r = 0.34
    for (let i = 0; i < nu; i++) {
      const u = (2 * Math.PI * i) / nu
      for (let j = 0; j < nv; j++) {
        const v = (2 * Math.PI * j) / nv
        const ring = R + r * Math.cos(v)
        const p = zeros(dim)
        p[0] = ring * Math.cos(u)
        p[1] = ring * Math.sin(u)
        p[2] = r * Math.sin(v)
        vertices.push(p)
      }
    }
  } else {
    // dim >= 4: Clifford / flat torus living in dims 0..3.
    const a = 0.7
    const b = 0.7
    for (let i = 0; i < nu; i++) {
      const u = (2 * Math.PI * i) / nu
      for (let j = 0; j < nv; j++) {
        const v = (2 * Math.PI * j) / nv
        const p = zeros(dim)
        p[0] = a * Math.cos(u)
        p[1] = a * Math.sin(u)
        p[2] = b * Math.cos(v)
        p[3] = b * Math.sin(v)
        vertices.push(p)
      }
    }
  }

  // Grid edges with wrap-around in both directions.
  const edges = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      edges.push([idx(i, j), idx((i + 1) % nu, j)])
      edges.push([idx(i, j), idx(i, (j + 1) % nv)])
    }
  }

  // Grid quad faces (ordered cycles).
  const faces = []
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const i1 = (i + 1) % nu
      const j1 = (j + 1) % nv
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

function buildSphere(dim, sides) {
  // dim 2: a flat circle (disk perimeter) with one face.
  if (dim === 2) {
    const ring = polygonRing(dim, sides)
    return finalize(ring.vertices, ring.edges, ring.faces, dim)
  }

  // dim >= 3: UV sphere in dims 0,1,2, the rest left at 0.
  const nLon = sides // longitude segments
  const nLat = sides // latitude divisions (poles + (nLat-1) interior rings)

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
// Public entry point
// ---------------------------------------------------------------------------

export function buildShape(type, dim, sides) {
  // Robust clamping of inputs.
  dim = Math.round(Number(dim))
  if (!Number.isFinite(dim)) dim = 3
  dim = Math.max(1, Math.min(8, dim))

  sides = Math.round(Number(sides))
  if (!Number.isFinite(sides)) sides = 6
  sides = Math.max(3, Math.min(24, sides))

  // dim 1 is a segment for every shape.
  if (dim === 1) return segment(dim)

  switch (type) {
    case 'hypercube':
      return buildHypercube(dim)
    case 'simplex':
      return buildSimplex(dim)
    case 'crossPolytope':
      return buildCrossPolytope(dim)
    case 'torus':
      return buildTorus(dim, sides)
    case 'prism':
      return buildPrism(dim, sides)
    case 'sphere':
      return buildSphere(dim, sides)
    default:
      return buildHypercube(dim)
  }
}
