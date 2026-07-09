/**
 * Pure logic for the two motion toggles.
 *
 *   Rotate       — rigid spin of the projected 3D object (handled in main.js
 *                  via the Three.js group; no N-D math involved).
 *   Shape Change — everything that morphs the projection through the hidden
 *                  axes (>= 3): N-D rotations touching a hidden axis plus the
 *                  hidden-depth pulse below.
 */

// Amplitude of the hidden-depth pulse: hidden coordinates breathe by ±28%,
// which telescopes the projected nesting without touching x/y/z orientation.
const HIDDEN_DEPTH_PULSE = 0.28

/**
 * A rotation plane belongs to Shape Change only when both axes are
 * depth-like: z (axis 2) or hidden (>= 3). The (2,3) plane is the classic
 * "inside-out" tesseract morph, and hidden-hidden planes reshuffle projection
 * depth. Planes touching x or y are excluded even when the other axis is
 * hidden — rotating x or y through a hidden axis projects as a turntable
 * turn about the vertical/horizontal axis, which reads as spin, and spin
 * belongs to Rotate. Because x and y stay untouched, all Shape Change motion
 * is radial nesting/telescoping with no apparent rotation.
 */
export function isShapeChangeRotation(rotation) {
  return rotation.i >= 2 && rotation.j >= 3
}

/**
 * Hidden-depth pulse: scale each hidden coordinate by a slow sine of `phase`,
 * offset per axis so the axes breathe out of step. Returns a new vertex array
 * (input is never mutated). When `enabled` is false this is the identity, so
 * toggling Shape Change off always restores the undeformed shape.
 */
export function applyShapeChange(vertices, phase, enabled) {
  if (!enabled) return vertices

  const out = new Array(vertices.length)
  for (let i = 0; i < vertices.length; i++) {
    const point = vertices[i].slice()
    for (let axis = 3; axis < point.length; axis++) {
      point[axis] *= 1 + HIDDEN_DEPTH_PULSE * Math.sin(phase + axis * 1.618)
    }
    out[i] = point
  }
  return out
}
