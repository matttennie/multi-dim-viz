/**
 * N-dimensional rotation and projection math.
 *
 * CONTRACT (do not change signatures — main.js depends on them):
 *
 *   makeAutoRotations(dim) -> Array<{ i:number, j:number, angle:number, speed:number }>
 *     Returns the set of coordinate-plane rotations used by the auto-rotate
 *     tumble for a shape of dimension `dim`. Each entry rotates in the plane
 *     spanned by axes i and j (0 <= i < j < dim). `angle` is the current angle
 *     (start at 0), `speed` in radians/second.
 *
 *     Pick speeds that are incommensurate (no simple ratios) so the tumble does
 *     not visibly repeat. Always include a low-index plane (e.g. 0-1) for a
 *     familiar spin, and for dim >= 4 include plane(s) involving the highest
 *     axes so the extra dimensions are visibly revealed. For dim < 2 return [].
 *
 *   advanceRotations(rotations, dtSeconds) -> void
 *     Mutates each rotation's `angle += speed * dtSeconds`.
 *
 *   rotatePoints(vertices, rotations) -> number[][]
 *     Returns NEW vertex array (same dim) with every rotation applied in order.
 *     A rotation in plane (i,j) by angle a maps:
 *        x_i' =  x_i*cos(a) - x_j*sin(a)
 *        x_j' =  x_i*sin(a) + x_j*cos(a)
 *     Must not mutate the input. Skip rotations whose i or j >= vertex length.
 *
 *   projectTo3D(vertices, mode, distance) -> Array<[number,number,number]>
 *     Collapses each N-D vertex down to exactly 3 components.
 *       mode 'orthographic' : keep the first 3 coordinates (drop the rest).
 *       mode 'perspective'  : collapse one axis at a time from the highest index
 *         down to index 3. For each axis k being dropped, scale the remaining
 *         (still-present) coordinates by  f = distance / (distance - x_k),
 *         clamped to avoid division blow-ups / sign flips (keep denominator
 *         strictly positive, e.g. clamp x_k to < distance * 0.95). After
 *         collapsing to 3 (or fewer) coords, pad missing coords with 0 so the
 *         result is always [x, y, z].
 *     For dim <= 3 just pad with zeros (no perspective division needed).
 */

// Base angular rate for the auto-rotate tumble (rad/s) and a table of
// irrational-ish multipliers. Mixing √2, √3, √5 and π based factors keeps every
// pairwise ratio irrational, so combined the tumble never visibly repeats.
// With BASE_SPEED = 0.47 every resulting speed lands in the pleasant
// ~0.15 .. ~0.47 rad/s range (modest, not dizzying).
const BASE_SPEED = 0.47
const SPEED_FACTORS = [
  1.0, //       0.470 rad/s  — familiar primary spin
  0.86603, //  0.407 rad/s  — √3 / 2
  0.78540, //  0.369 rad/s  — π / 4
  0.70711, //  0.332 rad/s  — 1 / √2
  0.61803, //  0.290 rad/s  — (√5 − 1) / 2  (1/φ)
  0.52360, //  0.246 rad/s  — π / 6
  0.41421, //  0.195 rad/s  — √2 − 1
  0.31831, //  0.150 rad/s  — 1 / π
]

export function makeAutoRotations(dim) {
  if (dim < 2) return []

  // Consecutive coordinate-plane chain: (0,1),(1,2),...,(dim-2,dim-1).
  // This covers every axis, always includes the familiar (0,1) spin, includes
  // (1,2) for dim >= 3, and includes the highest plane (dim-2, dim-1) for
  // dim >= 4 — all without any axis being left static.
  const planes = []
  for (let i = 0; i + 1 < dim; i++) {
    planes.push([i, i + 1])
  }

  // For dim >= 4 also mix the lowest and highest axis directly so the new
  // dimensions are revealed by more than just adjacent-axis wobble.
  if (dim >= 4) {
    planes.push([0, dim - 1])
  }

  const rotations = []
  for (let k = 0; k < planes.length; k++) {
    const factor = SPEED_FACTORS[k % SPEED_FACTORS.length]
    // If we ever run past the table (dim > 8) apply a tiny decay per wrap so
    // the reused factors stay distinct and incommensurate.
    const decay = 1 - 0.011 * Math.floor(k / SPEED_FACTORS.length)
    rotations.push({
      i: planes[k][0],
      j: planes[k][1],
      angle: 0,
      speed: BASE_SPEED * factor * decay,
    })
  }
  return rotations
}

export function advanceRotations(rotations, dtSeconds) {
  for (let k = 0; k < rotations.length; k++) {
    rotations[k].angle += rotations[k].speed * dtSeconds
  }
}

export function rotatePoints(vertices, rotations) {
  const n = rotations.length

  // Precompute sin/cos for each rotation once (not per vertex).
  const cos = new Array(n)
  const sin = new Array(n)
  const ii = new Array(n)
  const jj = new Array(n)
  for (let k = 0; k < n; k++) {
    const r = rotations[k]
    cos[k] = Math.cos(r.angle)
    sin[k] = Math.sin(r.angle)
    ii[k] = r.i
    jj[k] = r.j
  }

  const out = new Array(vertices.length)
  for (let v = 0; v < vertices.length; v++) {
    const src = vertices[v]
    const len = src.length
    // Copy the row so the input is never mutated.
    const p = src.slice()
    for (let k = 0; k < n; k++) {
      const i = ii[k]
      const j = jj[k]
      // Skip rotations that reference an axis this vertex does not have.
      if (i >= len || j >= len) continue
      const c = cos[k]
      const s = sin[k]
      const xi = p[i]
      const xj = p[j]
      p[i] = xi * c - xj * s
      p[j] = xi * s + xj * c
    }
    out[v] = p
  }
  return out
}

export function projectTo3D(vertices, mode, distance) {
  const out = new Array(vertices.length)

  for (let v = 0; v < vertices.length; v++) {
    const src = vertices[v]
    const len = src.length

    if (mode === 'perspective' && len > 3) {
      // Work on a copy of the present coordinates.
      const coords = src.slice()
      const limit = distance * 0.95
      // Collapse one axis at a time from the highest index down to 3.
      for (let k = len - 1; k >= 3; k--) {
        let xk = coords[k]
        // Clamp so the denominator stays strictly positive (no blow-ups /
        // sign flips). distance ~3, vertices are ~unit radius.
        if (xk > limit) xk = limit
        const f = distance / (distance - xk)
        // Scale the still-present coordinates (indices 0..k-1).
        for (let m = 0; m < k; m++) {
          coords[m] *= f
        }
        // coords[k] is now dropped (loop moves on to the next axis).
      }
      out[v] = [coords[0], coords[1], coords[2]]
    } else {
      // Orthographic, or dim <= 3: keep the first 3 coords, pad with 0.
      out[v] = [
        len > 0 ? src[0] : 0,
        len > 1 ? src[1] : 0,
        len > 2 ? src[2] : 0,
      ]
    }
  }
  return out
}
