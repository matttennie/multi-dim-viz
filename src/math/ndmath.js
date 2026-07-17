/**
 * N-dimensional rotation and projection math.
 *
 * CONTRACT (do not change signatures — main.js depends on them):
 *
 *   makeAutoRotations(dim) -> Array<{ i:number, j:number, angle:number, speed:number }>
 *     Returns the coordinate-plane rotations that drive the Shape Change
 *     morph: the depth-like planes (2,3),(3,4),...,(dim-2,dim-1). Planes
 *     touching the screen-facing x/y axes are never emitted — rotating x or y
 *     through a hidden axis projects as a turntable turn (apparent spin), and
 *     visible spin belongs to the rigid 3D rotation in main.js. `angle` is the
 *     current angle (start at 0), `speed` in radians/second; speeds are
 *     mutually incommensurate so the morph does not visibly repeat. For
 *     dim <= 3 returns [] — there is nothing hidden to morph.
 *
 *   advanceRotations(rotations, dtSeconds) -> void
 *     Mutates each rotation's `angle += speed * dtSeconds`. (main.js advances
 *     angles itself so it can gate them on the Shape Change toggle; this
 *     helper is used by scripts/bench-geometry.js.)
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

// Base angular rate for the morph planes (rad/s) and a table of irrational-ish
// multipliers. Mixing √2, √3, √5 and π based factors keeps every pairwise
// ratio irrational, so the combined morph never visibly repeats. With
// BASE_SPEED = 0.235 every resulting speed lands in a gentle
// ~0.075 .. ~0.235 rad/s range.
const BASE_SPEED = 0.235
const SPEED_FACTORS = [
  1.0, //       0.235 rad/s  — familiar primary spin
  0.86603, //  0.204 rad/s  — √3 / 2
  0.78540, //  0.185 rad/s  — π / 4
  0.70711, //  0.166 rad/s  — 1 / √2
  0.61803, //  0.145 rad/s  — (√5 − 1) / 2  (1/φ)
  0.52360, //  0.123 rad/s  — π / 6
  0.41421, //  0.097 rad/s  — √2 − 1
  0.31831, //  0.075 rad/s  — 1 / π
]

export function makeAutoRotations(dim) {
  // Consecutive depth-plane chain: (2,3),(3,4),...,(dim-2,dim-1). This covers
  // every hidden axis, always includes the classic (2,3) z↔w "inside-out"
  // plane at dim >= 4, and naturally yields [] for dim <= 3.
  const rotations = []
  for (let i = 2; i + 1 < dim; i++) {
    rotations.push({
      i,
      j: i + 1,
      angle: 0,
      speed: BASE_SPEED * SPEED_FACTORS[i % SPEED_FACTORS.length],
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
