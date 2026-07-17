/**
 * Lines mode renderer: draws shape edges as colored line segments.
 *
 * CONTRACT (used by main.js):
 *   class LinesRenderer {
 *     get object3D()            // a THREE.Object3D to add to the scene
 *     build(shape)              // shape = { vertices(base N-D), edges }
 *                               //   Allocate a position buffer of 2 vertices
 *                               //   per edge. Assign each edge a color via
 *                               //   dominantAxis(base endpoints) -> colorForAxis,
 *                               //   writing that color to BOTH endpoints
 *                               //   (vertex colors). Colors are computed ONCE
 *                               //   here from the un-rotated base geometry.
 *     update(projected3D)       // projected3D : Array<[x,y,z]> aligned to
 *                               //   shape.vertices order. Write endpoint
 *                               //   positions for every edge into the position
 *                               //   attribute and flag it needsUpdate.
 *   }
 *
 * Implementation notes:
 *   - Use THREE.LineSegments with a BufferGeometry. Material:
 *     LineBasicMaterial({ vertexColors: true }). (Line materials ignore lights,
 *     which is correct for this mode.)
 *   - Cache the edge list and a Float32Array for positions between frames;
 *     reallocate in build() only when the edge count changes.
 *   - update() must be cheap (no per-frame allocation of the typed array).
 */
import * as THREE from 'three'
import { colorForAxis, dominantAxis } from './colors.js'

export class LinesRenderer {
  constructor() {
    this._geometry = new THREE.BufferGeometry()
    this._material = new THREE.LineBasicMaterial({ vertexColors: true })
    this._lineSegments = new THREE.LineSegments(this._geometry, this._material)

    this._edges = []
    this._positions = null // Float32Array, reused between frames
  }

  get object3D() {
    return this._lineSegments
  }

  build(shape) {
    const edges = shape.edges || []
    const vertices = shape.vertices || []
    this._edges = edges

    const vertexCount = edges.length * 2
    const floatCount = vertexCount * 3

    // Reallocate the position typed array only when the edge count changes.
    if (!this._positions || this._positions.length !== floatCount) {
      this._positions = new Float32Array(floatCount)
      this._geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(this._positions, 3),
      )
    }

    // Colors are computed ONCE here from the un-rotated base geometry, so they
    // stay stable as the shape rotates. Both endpoints of an edge get the same
    // color (the color of the edge's dominant axis).
    const colors = new Float32Array(floatCount)
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i]
      const color = colorForAxis(dominantAxis(vertices[a], vertices[b]))
      const o = i * 6
      // first endpoint
      colors[o] = color.r
      colors[o + 1] = color.g
      colors[o + 2] = color.b
      // second endpoint
      colors[o + 3] = color.r
      colors[o + 4] = color.g
      colors[o + 5] = color.b
    }
    this._geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }

  update(projected3D) {
    const positions = this._positions
    if (!positions) return
    const edges = this._edges

    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i]
      const pa = projected3D[a]
      const pb = projected3D[b]
      const o = i * 6
      positions[o] = pa[0]
      positions[o + 1] = pa[1]
      positions[o + 2] = pa[2]
      positions[o + 3] = pb[0]
      positions[o + 4] = pb[1]
      positions[o + 5] = pb[2]
    }

    this._geometry.attributes.position.needsUpdate = true
  }
}
