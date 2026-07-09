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
 * A rotation plane belongs to Shape Change when it touches at least one
 * hidden axis. Mixed planes like (2,3) are the ones that produce the classic
 * "inside-out" higher-dimensional morph; purely visible planes (both axes
 * < 3) would read as ordinary spatial spin, which Rotate owns.
 */
export function isShapeChangeRotation(rotation) {
  return rotation.i >= 3 || rotation.j >= 3
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
