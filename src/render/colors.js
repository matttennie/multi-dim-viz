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

/**
 * Returns the dominant axis of a face (used to color Planes mode the same way
 * edges are colored in Lines mode). The face's dominant axis is the dimension
 * with the largest coordinate spread (max − min) across the face's vertices —
 * the natural generalization of dominantAxis() from an edge (2 points) to a
 * polygon. Computed from the UN-rotated base geometry so face colors stay
 * stable while the shape spins.
 *
 *   vertices    : number[][]  the base N-D vertices
 *   faceIndices : number[]    indices into `vertices` forming the face
 */
export function dominantAxisOfFace(vertices, faceIndices) {
  if (!faceIndices || faceIndices.length === 0) return 0
  const dim = vertices[faceIndices[0]].length
  let best = 0
  let bestSpread = -Infinity
  for (let a = 0; a < dim; a++) {
    let min = Infinity
    let max = -Infinity
    for (let k = 0; k < faceIndices.length; k++) {
      const x = vertices[faceIndices[k]][a]
      if (x < min) min = x
      if (x > max) max = x
    }
    const spread = max - min
    // Use >= so that on a tie the HIGHER axis wins. An axis-aligned face (e.g. a
    // hypercube square in plane (i,j)) has equal spread on both axes; biasing to
    // the higher one makes each face show the highest dimension it spans, giving
    // Planes mode the same color variety as Lines mode.
    if (spread >= bestSpread) {
      bestSpread = spread
      best = a
    }
  }
  return best
}
