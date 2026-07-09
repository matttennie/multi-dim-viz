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

Then open the URL Vite prints (default http://127.0.0.1:5173/).

To build a static bundle: `npm run build` (output in `dist/`), preview with
`npm run preview`.

Useful checks:

```bash
npm run test     # geometry/projection invariants and budget caps
npm run bench    # CPU-side rotate/project benchmark for worst-case settings
npm audit        # dependency advisory check
```

## Portfolio deployment

This is a static Vite app. `npm run build` produces a self-contained `dist/`
folder that can be dropped into a portfolio site, Netlify/Vercel static deploy,
GitHub Pages, S3/CloudFront, or any ordinary static host.

The Vite config uses `base: './'`, so generated asset URLs are relative and work
when the app is hosted in a subdirectory such as `/projects/multi-dim-viz/`.
The dev server is localhost-only by default for safety; if you intentionally
need LAN testing, run `npm run dev -- --host 0.0.0.0`.

## Controls (top-right panel)

| Control | What it does |
| --- | --- |
| **Lines / Planes** | View mode toggle. |
| **FPS** | Live framerate (render is capped at 60). |
| **Shape** | Hypercube, Simplex, Cross-Polytope, Torus, Möbius Strip, N-gon Prism, Sphere/Hypersphere. |
| **Dimensions** | −/+ steppers, range **per shape** (see below). Updates live. |
| **Sides** | −/+ steppers, range **per shape** (see below). Disabled when side count is fixed or not applicable. |
| **Rotate** | Toggles rigid rotation in ordinary visible space. |
| **Shape Change** | Toggles the higher-dimensional morph: N-D rotations through hidden axes plus a hidden-depth pulse. Disabled at ≤3 dimensions (nothing hidden to morph); turning it off relaxes the shape back to its undeformed form. |
| **Projection** | Perspective (nested/telescoping look) ⇄ Orthographic (flat parallel). |

### Per-shape parameter ranges

Each shape only allows the parameter values where it's geometrically meaningful;
the steppers re-range (and re-clamp the current value) when you switch shapes.

| Shape | Dimensions | Sides | Why |
| --- | --- | --- | --- |
| Hypercube / Simplex / Cross-Polytope | 1–8 | — | meaningful at every dimension, incl. the 1-D segment |
| Torus | 2–8 | 2 fixed | 2D shows the circular/ring version; ≥3D shows the donut surface and higher ambient embeddings/projections |
| Möbius Strip | 3 fixed | 1 fixed | the strip is one-sided and the standard embedding needs 3D; higher ambient dims are not exposed |
| N-gon Prism | 2–8 | 3–12 | the cross-section polygon needs ≥3 sides |
| Sphere / Hypersphere | 2–8 | 2 fixed | orientable surface with inside/outside; tessellation is internal |

### Geometry and performance caps

The public controls are capped in code (`src/geometry/shapes.js`) and covered by
tests:

- dimensions: global max **8**
- user-facing side count: global max **12**
- surface tessellation detail: fixed internally at **12 segments**
- vertices: hard budget **≤ 5,000**
- fan-triangulated plane geometry: hard budget **≤ 20,000 triangles**

Only the N-gon Prism has an editable side count. Torus and Sphere/Hypersphere
are fixed at two sides (inside/outside), Möbius is fixed at one side, and
polytopes have no side-count control. The runtime defensively
clamps all external `buildShape()` inputs into each shape's valid range and
throws if a future shape change exceeds the vertex/triangle budgets.

When a number field receives focus, its whole value is selected automatically so
typing replaces the current number without needing an extra select gesture.

### Performance target

The render loop is capped near 60fps, and the geometry budgets are intended to
keep every setting comfortably above **30fps on modern desktop hardware**. Actual
browser FPS still depends on GPU, display power mode, browser, and whether
Planes mode is fill-rate bound on the target device.

`npm run bench` measures the CPU-side N-D rotation/projection path for the
largest setting of each shape. It does not measure GPU/WebGL fill-rate, but it
does catch geometry settings that are too large before they reach the renderer.

### Control semantics

This is still a visual-first visualizer; screen readers cannot make the
rendered geometry meaningful on their own. The control panel does use native
buttons, number inputs, checkbox controls, keyboard behavior, and ARIA state
where appropriate so the UI controls remain well-formed:

- segmented controls update `aria-pressed`
- the shape dropdown exposes combobox/listbox-style state (`aria-expanded`,
  `aria-selected`, labelled menu)
- disabled Sides controls are actually disabled in the DOM, not just dimmed
- the Rotate switch and steppers have explicit accessible labels

- **Drag** (mouse or touch) to rotate the view. Dragging manually turns the
  Rotate toggle off.
- **Fling while Rotate is off** to hand motion back to auto-rotate when you
  release. A slow drag/release leaves Rotate off.
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
tests/
  geometry.test.js      shape/projection invariants and budget checks
scripts/
  bench-geometry.js     CPU-side worst-case rotate/project benchmark
```

## Design notes & decisions

- **Per-axis edge coloring.** In Lines mode each edge is colored by its
  *dominant axis* — the dimension along which its two endpoints differ most,
  computed once from the un-rotated base geometry so colors stay stable while
  the shape spins. Axes 0/1/2 deliberately share one color (they're the
  familiar spatial dimensions); axes 3–7 each get a distinct vivid hue so a
  higher-dimensional edge is instantly identifiable.
- **Default dimensional view.** The app starts at 3-D, and switching shapes
  resets to the 3-D view whenever the selected shape supports it. Lower
  dimensional versions remain available where meaningful (e.g. square for
  2-cube, triangle for 2-simplex, circle/ring for 2D torus/sphere).
- **Rotation vs. shape change.** Visible-space rotation and high-dimensional
  projection morphing are separate controls. `Rotate` spins the projected 3D
  object as a rigid Three.js object; `Shape Change` drives the depth-like
  rotation planes — z↔hidden (the classic (2,3) "inside-out" morph) and
  hidden↔hidden — plus a hidden-depth pulse. Planes touching x or y are never
  auto-driven, even against a hidden axis: rotating x or y through hidden
  depth projects as a turntable turn (apparent spin), and spin belongs to
  `Rotate` alone. With x/y untouched, Shape Change motion is purely radial
  nesting/telescoping with no apparent rotation.
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
  dims 0–2 that tumble through the higher dimensions via rotation.) Their
  surface tessellation is fixed at 12 segments and is separate from
  mathematical side count.
- **Normalization.** Every shape is centered and uniformly scaled so its maximum
  radius is ~1, so all shapes and dimensions fit the same view without
  per-axis distortion.
- **Auto-rotate behavior.** Automatic motion runs at half the original speed.
  Manual drag disables visible-space rotation; a fast fling while Rotate is off
  re-enables it on release so the user can hand motion back to the app.
- **60fps cap.** The render loop throttles with a threshold a hair below one
  true 60Hz frame (`1000/62`), so genuine 60Hz displays never beat-frequency
  skip a jittery frame while 120/144Hz displays are still capped to ~60.
- **Portfolio-safe defaults.** The production bundle uses relative asset paths,
  so it can live under a portfolio subdirectory. The dev server binds to
  localhost unless explicitly overridden.
- **Module contracts.** `main.js` owns integration and imports fixed
  function/class signatures; geometry, math, and rendering are isolated leaf
  modules behind those contracts (`{ vertices[][], edges[][], faces[][] }` is
  the shared data shape), which keeps each module independently testable.

## More screenshots

See [`docs/screenshots/`](docs/screenshots/) — tesseract (lines & planes), the
round 3D torus, an 8D coiled torus, the Möbius strip, 8-cube (perspective &
orthographic), 5-simplex, 4D cross-polytope, octagonal prism, a sphere, the
dimension-colored planes, and the classic shape dropdown.
