/**
 * Dimension -> color mapping for Lines mode.
 *
 * CONTRACT:
 *   colorForAxis(axisIndex) -> THREE.Color
 *     Maps an axis index (the dimension an edge runs most along) to a color.
 *     RULE: axes 0, 1, and 2 all share ONE base color. Axes 3..7 each get a
 *     distinct, vivid color. The palette should read clearly on a black
 *     background (avoid near-black hues).
 *
 *   dominantAxis(vertexA, vertexB) -> number
 *     Given two N-D vertex coordinate arrays (an edge), returns the index of
 *     the axis with the largest absolute difference — i.e. the dimension the
 *     edge extends most along. Used to assign each edge its color from the
 *     UN-rotated base geometry (so colors stay stable while the shape spins).
 */
import * as THREE from 'three'

// Shared base color for the first three (spatial) axes: a clean bright cyan
// that reads crisply on pure black.
const BASE_AXIS_COLOR = '#7fe7ff'

// Distinct, vivid hues for the higher dimensions (axes 3..7). Each is chosen
// to be clearly distinguishable from the others and from the base cyan, and to
// stay bright against a black background.
const HIGHER_AXIS_COLORS = {
  3: '#ff5d8f', // vivid pink / magenta
  4: '#54e36a', // vivid green
  5: '#ffa726', // vivid orange
  6: '#b06bff', // vivid violet
  7: '#ffe14d', // vivid yellow
}

/**
 * Returns the color for a given axis index. Axes 0,1,2 share the base color;
 * axes 3..7 each return their own distinct hue. A fresh THREE.Color is returned
 * on every call so callers can safely mutate it without affecting the palette.
 */
export function colorForAxis(axisIndex) {
  const hex =
    axisIndex >= 3 && axisIndex <= 7
      ? HIGHER_AXIS_COLORS[axisIndex]
      : BASE_AXIS_COLOR
  return new THREE.Color(hex)
}

/**
 * Returns the index of the axis along which the two vertices differ most.
 */
export function dominantAxis(vertexA, vertexB) {
  let best = 0
  let bestDiff = -Infinity
  const n = Math.min(vertexA.length, vertexB.length)
  for (let i = 0; i < n; i++) {
    const diff = Math.abs(vertexA[i] - vertexB[i])
    if (diff > bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}
