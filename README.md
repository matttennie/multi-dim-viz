# Multi-Dimensional Shape Visualizer

An interactive visualizer for geometric shapes in **1 to 8 dimensions**, rendered
on a black canvas with Three.js. Watch polytopes, tori, prisms and spheres tumble
through their higher-dimensional rotation planes and project down into 3D.

![8-cube in Lines mode](docs/screenshots/04-hypercube-8d-lines.png)

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173/).

To build a static bundle: `npm run build` (output in `dist/`), preview with
`npm run preview`.

## Controls (top-right panel)

| Control | What it does |
| --- | --- |
| **Lines / Planes** | View mode toggle. |
| **FPS** | Live framerate (render is capped at 60). |
| **Shape** | Hypercube, Simplex, Cross-Polytope, Torus, Möbius Strip, N-gon Prism, Sphere/Hypersphere. |
| **Dimensions** | 1–8, with −/+ steppers (capped). Updates live. |
| **Sides** | 1–24, with −/+ steppers (capped at 24 to protect performance). Greyed out for shapes that don't use it (hypercube, simplex, cross-polytope). For the prism it's the polygon side count (clamped to ≥3 internally, since a polygon needs at least 3 sides); for curved shapes (torus, Möbius, sphere) it nudges detail — the torus and Möbius always render smooth. |
| **Rotate** | Toggles the automatic N-dimensional tumble. Changing other settings does **not** reset it — the tumble continues from its current orientation. |
| **Projection** | Perspective (nested/telescoping look) ⇄ Orthographic (flat parallel). |

- **Drag** (mouse or touch) to rotate the view.
- **Scroll / pinch** to zoom.
- There are intentionally no camera-movement (pan/fly) controls.

## View modes

- **Lines** — draws the shape's edges. Each edge is colored by the axis it runs
  most along. Per the original design, axes 1/2/3 share one color (cyan); axes
  4–8 each get a distinct vivid hue, so you can read off which dimension an edge
  belongs to.
- **Planes** — draws the shape's 2-faces as semi-transparent, double-sided lit
  surfaces. Faces are colored the **same way as edges**: each face takes the
  color of its dominant axis (same 1/2/3-shared, 4–8-distinct palette), applied
  as vertex colors over a white material so the light still shades them. A
  single external light source sits outside the object and surface normals are
  recomputed every frame, so the light visibly plays across the faces as the
  shape morphs. (Lighting on an N-D projection is physically hand-wavy by
  nature — it's there to make the structure legible and pretty.)

## How it works

The pipeline, per frame:

1. **Generate** the shape as N-dimensional vertices / edges / faces
   (`src/geometry/shapes.js`), centered and normalized to a unit radius.
2. **Rotate** the vertices in a set of coordinate planes — including planes
   involving the highest axes so the extra dimensions are revealed
   (`src/math/ndmath.js`).
3. **Project** N-D → 3D, collapsing one dimension at a time (perspective divides
   by a viewing-distance term at each step; orthographic just drops the extra
   coordinates).
4. **Render** the 3D result with Three.js, which projects 3D → 2D for the screen.

### Project layout

```
src/
  main.js               integration: scene, camera, lights, loop, wiring
  geometry/shapes.js    N-D shape generation (vertices / edges / faces)
  math/ndmath.js        N-D rotation + projection
  render/colors.js      dimension -> color mapping
  render/linesRenderer.js   edges as colored line segments
  render/planesRenderer.js  faces as lit translucent surfaces
  ui/panel.js           the top-right control panel
  ui/fps.js             rolling FPS meter
  style.css
```

## Design notes & decisions

- **Per-axis edge coloring.** In Lines mode each edge is colored by its
  *dominant axis* — the dimension along which its two endpoints differ most,
  computed once from the un-rotated base geometry so colors stay stable while
  the shape spins. Axes 0/1/2 deliberately share one color (they're the
  familiar spatial dimensions); axes 3–7 each get a distinct vivid hue so a
  higher-dimensional edge is instantly identifiable.
- **N-D rotation planes.** A rotation in N dimensions happens in a *plane*
  (a pair of axes), not around an axis. The auto-tumble rotates through a chain
  of coordinate planes — always including a low plane for a familiar spin and,
  for dim ≥ 4, planes involving the highest axes so the new dimensions are
  visibly revealed. Plane speeds are mutually incommensurate, so the tumble
  never visibly repeats. Changing the shape/dimension/sides preserves the
  current rotation angles (matching planes carry over), so the tumble keeps
  moving continuously instead of snapping back to the start.
- **Projection.** N-D → 3D collapses one axis at a time. Perspective divides the
  remaining coordinates by a `distance − xₖ` term at each step (the nested
  "tesseract" look); orthographic simply drops the extra coordinates. Three.js
  then handles the final 3D → 2D camera projection.
- **Curved shapes & dimension.** A torus is a 2-surface, so the literal
  higher-dimensional object is the n-torus (a product of n circles). But as a
  space-filling manifold its translucent 2-faces self-overlap so heavily they
  collapse the lit Planes mode (fragment-bound overdraw). So the torus is kept a
  single 2-surface that *coils* into each higher axis with its own winding
  harmonic — it visibly changes at every dimension while staying a fast,
  low-overdraw shell. (The Möbius and sphere are likewise surfaces living in
  dims 0–2 that tumble through the higher dimensions via rotation.)
- **Normalization.** Every shape is centered and uniformly scaled so its maximum
  radius is ~1, so all shapes and dimensions fit the same view without
  per-axis distortion.
- **60fps cap.** The render loop throttles with a threshold a hair below one
  true 60Hz frame (`1000/62`), so genuine 60Hz displays never beat-frequency
  skip a jittery frame while 120/144Hz displays are still capped to ~60.
- **Module contracts.** `main.js` owns integration and imports fixed
  function/class signatures; geometry, math, and rendering are isolated leaf
  modules behind those contracts (`{ vertices[][], edges[][], faces[][] }` is
  the shared data shape), which keeps each module independently testable.

## More screenshots

See [`docs/screenshots/`](docs/screenshots/) — tesseract (lines & planes), the
round 3D torus, an 8D coiled torus, the Möbius strip, 8-cube (perspective &
orthographic), 5-simplex, 4D cross-polytope, octagonal prism, a sphere, the
dimension-colored planes, and the classic shape dropdown.
