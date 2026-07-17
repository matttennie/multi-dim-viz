/**
 * Planes mode renderer: draws shape faces as semi-transparent lit surfaces.
 *
 * CONTRACT (used by main.js):
 *   class PlanesRenderer {
 *     get object3D()            // a THREE.Object3D to add to the scene
 *     build(shape)              // shape = { vertices(base N-D), faces }
 *                               //   Fan-triangulate each face polygon
 *                               //   (v0,vk,vk+1) into a triangle list. Store
 *                               //   the flat triangle->vertexIndex map and
 *                               //   allocate a position buffer (3 verts per
 *                               //   triangle, non-indexed so per-face normals
 *                               //   are crisp).
 *     update(projected3D)       // projected3D : Array<[x,y,z]> aligned to
 *                               //   shape.vertices order. Write triangle vertex
 *                               //   positions, then recompute vertex normals
 *                               //   (geometry.computeVertexNormals()) so the
 *                               //   external light visibly plays across the
 *                               //   morphing surface. Flag attributes dirty.
 *   }
 *
 * Implementation notes:
 *   - Use THREE.Mesh + BufferGeometry (non-indexed). Material:
 *     MeshStandardMaterial({ vertexColors, transparent, side:DoubleSide,
 *       metalness, roughness, depthWrite:false }). depthWrite:false avoids ugly
 *       transparency sorting.
 *   - Faces are colored the SAME way edges are in Lines mode: each face takes
 *     the color of its dominant axis (axes 0/1/2 share a color, 3..7 distinct),
 *     applied as per-vertex colors with a white material base so the scene
 *     light still shades them.
 *   - The light(s) live in the scene (set up in main.js); this renderer only
 *     provides the lit mesh.
 *   - update() should reuse the same typed arrays between frames (only
 *     reallocate in build() when triangle count changes).
 */
import * as THREE from 'three'
import { colorForAxis, dominantAxisOfFace } from './colors.js'

export class PlanesRenderer {
  constructor() {
    this._geometry = new THREE.BufferGeometry()
    this._material = new THREE.MeshStandardMaterial({
      color: 0xffffff, // white base so per-vertex dimension colors show true
      vertexColors: true,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      metalness: 0.1,
      roughness: 0.45,
      depthWrite: false,
    })
    this._mesh = new THREE.Mesh(this._geometry, this._material)

    // Flat list of vertex indices, 3 per triangle (the triangle -> vertexIndex
    // map produced by fan-triangulating the faces).
    this._triIndices = []
    this._positions = null // Float32Array, reused between frames
  }

  get object3D() {
    return this._mesh
  }

  build(shape) {
    const faces = shape.faces || []
    const baseVerts = shape.vertices || []

    // Fan-triangulate each face polygon: face [v0,v1,...,vk] -> triangles
    // (v0,v1,v2),(v0,v2,v3),... Store the flat triangle->vertexIndex list, and
    // build a parallel per-vertex color array: every triangle of a face gets
    // that face's dominant-axis color (computed once from the base geometry, so
    // colors stay stable while the shape spins).
    const triIndices = []
    const colorList = [] // r,g,b per emitted triangle vertex
    for (let f = 0; f < faces.length; f++) {
      const face = faces[f]
      const c = colorForAxis(dominantAxisOfFace(baseVerts, face))
      for (let i = 1; i < face.length - 1; i++) {
        triIndices.push(face[0], face[i], face[i + 1])
        // three vertices for this triangle, all the same face color
        colorList.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r, c.g, c.b)
      }
    }
    this._triIndices = triIndices

    const floatCount = triIndices.length * 3 // each index -> x,y,z

    // Non-indexed geometry: each triangle has its own 3 vertices so recomputed
    // normals stay crisp per face. Reallocate only when the triangle count
    // (i.e. the float count) changes.
    if (!this._positions || this._positions.length !== floatCount) {
      this._positions = new Float32Array(floatCount)
      this._geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(this._positions, 3),
      )
      // Drop any stale normals; computeVertexNormals() in update() will
      // (re)create a correctly sized normal attribute.
      this._geometry.deleteAttribute('normal')
    }

    // Colors are static for a given shape; (re)build the attribute each build().
    this._geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(colorList), 3),
    )
  }

  update(projected3D) {
    const positions = this._positions
    if (!positions) return
    const tri = this._triIndices

    for (let i = 0; i < tri.length; i++) {
      const p = projected3D[tri[i]]
      const o = i * 3
      positions[o] = p[0]
      positions[o + 1] = p[1]
      positions[o + 2] = p[2]
    }

    this._geometry.attributes.position.needsUpdate = true
    // Recompute per-frame so the external light visibly plays across the
    // morphing surface (this also flags the normal attribute dirty).
    this._geometry.computeVertexNormals()
  }
}
