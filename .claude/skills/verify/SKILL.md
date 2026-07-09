---
name: verify
description: Build/launch/drive recipe for verifying multi-dim-viz changes end-to-end in a browser
---

# Verifying multi-dim-viz

Vite single-page app, no backend. Surface = the rendered WebGL canvas + the
top-right control panel.

## Launch

```bash
npm run dev -- --port 5199 --strictPort   # run in background
# app at http://localhost:5199
```

## Drive (Playwright MCP)

- `browser_navigate` to the URL, then `browser_snapshot` — the panel is fully
  accessible (roles/labels): `checkbox "Rotate"`, `checkbox "Shape Change"`,
  `spinbutton "Dimensions"`, `combobox "Shape"`, `button "Persp"/"Ortho"`,
  `button "Lines"/"Planes"`.
- The scene is WebGL, so evidence = screenshots. Motion evidence: two
  screenshots ~1.5–2.5s apart (use `browser_evaluate` with a setTimeout
  promise to wait; there is no exposed app state on `window`).
- Two identical frames will still hash differently — the FPS counter
  repaints. Compare geometry visually, not by checksum.
- Screenshots land in the repo root (cwd) — move them to the scratchpad
  afterward so they don't pollute the repo. `.playwright-mcp/` is gitignored.

## Flows worth driving

- Boot: 3D hypercube, Rotate ON spins on two axes; Shape Change row is
  dimmed/disabled at dim ≤ 3.
- Dimensions → 4+: Shape Change enables; with Rotate OFF the shape should
  still morph (depth-like rotation planes z↔hidden / hidden↔hidden + depth
  pulse) but must NOT appear to turn about the vertical or horizontal axis —
  all screen motion should be radial (nesting/telescoping). Apparent turning
  means a plane touching x or y leaked into shape change.
- Toggle Shape Change OFF mid-morph: shape relaxes instantly to undeformed
  and stays static; a Persp→Ortho→Persp round-trip must reproduce the same
  frame (no stale deformation).
- Shape switch to Möbius (fixed 3D) re-disables Shape Change without
  clearing its checked state.
- Stress: hypercube at 8D with both toggles on — expect ~40–60 FPS
  (headless/software GL is slower than real hardware).

## Gotchas

- Unit tests (`npx vitest run`) cover geometry budgets and the pure motion
  logic in `src/math/motion.js` — they are not a substitute for driving the
  canvas.
- Dragging the canvas intentionally switches Rotate off (documented UX);
  don't mistake it for a regression while driving with a mouse.
