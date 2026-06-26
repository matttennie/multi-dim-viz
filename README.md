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
| **Shape** | Hypercube, Simplex, Cross-Polytope, Torus, N-gon Prism, Sphere/Hypersphere. |
| **Dimensions** | 1–8, with −/+ steppers (capped). Updates live. |
| **Sides** | 3–24, with −/+ steppers. Greyed out for shapes that don't use it (hypercube, simplex, cross-polytope). |
| **Rotate** | Toggles the automatic N-dimensional tumble. |
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
  surfaces. A single external light source sits outside the object and surface
  normals are recomputed every frame, so the light visibly plays across the
  faces as the shape morphs. (Lighting on an N-D projection is physically
  hand-wavy by nature — it's there to make the structure legible and pretty.)

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

## More screenshots

See [`docs/screenshots/`](docs/screenshots/) — tesseract (lines & planes), 3D
torus, 8-cube (perspective & orthographic), 5-simplex, 4D cross-polytope,
5D octagonal prism, and a sphere.
