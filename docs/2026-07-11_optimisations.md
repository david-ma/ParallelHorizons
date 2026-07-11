# Gallery performance optimisations — 2026-07-11

## Problem

The **Monet at the Met** gallery (`/view/met-monet`) places **30 paintings**, each with a real-time `SpotLight`, emitter disc, and GLB fixture. Parallel Horizons has **9**. Profiling and code review pointed to:

| Factor | Impact | Notes |
|--------|--------|-------|
| **30 dynamic SpotLights** | **Critical** | Lambert walls evaluate lighting per fragment; lights are not frustum-culled by Three.js |
| Draw calls (~330+ when crowded) | High | Separate frame/placard meshes; 30 fixtures × 3 material groups |
| 30 cloned GLB fixtures | Medium | Shared geometry buffers (~660 tris each) but still 90 draw calls when all visible |
| MSAA + pixel ratio 2 | Medium | Heavy on Retina Chrome/Safari |
| Spotlight mesh complexity | Low | 660 tris/fixture — not the bottleneck vs lights/draw calls |
| Rapier physics | Low | One dynamic player body; paintings are static AABBs only |
| Off-screen meshes | Already OK | Three.js mesh frustum culling (default) |

Browser variance (Chrome/Safari vs Firefox/Cursor) is partly GPU throttling (Energy Saver) and partly fill-rate when many lit surfaces are on screen.

---

## Asset poly / draw-call inventory

| Asset | Tris | Draw calls (per item) | Where |
|-------|------|------------------------|-------|
| Spotlight GLB fixture | 660 (574+62+24) | 3 (one per material) | `Spotlight.glb` — 3 meshes |
| Procedural fallback cone | 24 | 1 | `spotlight.ts` on GLB load failure |
| JSON frame + moulding (`addFrameToArtwork`) | 96 | **8** → **2** after merge | `artwork.ts` |
| Legacy hand-built frame (`drawFrame`) | 28 | 2 | `artwork.ts` / `gallery.ts` |
| Painting plane | 2 | 1 | shared texture per artwork |
| Placard | 2 | 1 | optional, canvas texture |

**Met gallery totals (30 paintings):** ~2,880 frame tris; fixtures were up to **90 draw calls** (30 × 3) before instancing.

---

## Optimisation strategies

### A. SpotLight culling (implemented)

- Cap active lights at **8** (`maxActiveSpotlights`).
- **Fixtures always drawn**; emitter + SpotLight **fade in 100 ms**; **2 s hold** after out of view before fade off.
- Eligibility (any one qualifies):
  - Artwork in **camera FOV + 3°** and not wall-occluded, or
  - Within **4 m** of player (including behind), or
  - Player inside **floor beam pool**, or
  - **Floor beam pool in camera view** (center/rim, unoccluded).
- Priority: in-view → near-player → floor hitbox; then cap at 8.
- Dev: minimap (beam fade/hold rings), light debug panel, `?debugLights=1`.

### B. InstancedMesh fixtures (implemented)

- One `InstancedMesh` per GLB material layer (3 layers → **3 draw calls** for all fixtures).
- Per-rig world matrix written each frame; culled instances scaled to zero.
- Shared geometry + materials; **mount proxy keeps full GLB hierarchy** (parent `spotlight002` has 100× scale — must not flatten meshes).
- Per-layer instance matrix taken from each proxy mesh `matrixWorld`, not the root alone.
- Fallback: single instanced cone layer if GLB fails to load.

### C. Frame draw-call reduction (implemented)

- `addFrameToArtwork`: merge 4 moulding boxes → 1 mesh, 4 frame boxes → 1 mesh (**8 → 2** draw calls per painting).
- `drawFrame`: already 2 meshes (black border + white backing); hand-built, 28 tris — left as-is.

### D. Adaptive pixel ratio (implemented)

- `resolveMaxPixelRatio()`: cap **1.25** on galleries with ≥20 paintings; **2** on small galleries.
- Override: `?quality=low` (1.0) or `?quality=high` (2.0).

### E. Shared fixture geometry (superseded by instancing)

- `cloneFixtureWithSharedAssets()` — deep hierarchy, shared GPU buffers. Replaced by instancing; kept mount-proxy pattern for bbox.

### F. Simplify fixture mesh (optional, not done)

| Approach | Tris | Draw calls | Effort |
|----------|------|------------|--------|
| Procedural cone/cylinder in code | ~24–50 | 1 (instanced) | Low |
| `gltf-transform simplify` on GLB | ~165 at 25% ratio | 3 | CLI, no code |
| Blender decimate | tunable | 3 | Manual |

660 tris is cheap; instancing addresses the real cost (draw calls).

### G. Light probes / baked ambient (future)

- Reduce fill-light + dynamic spot contribution on far walls.
- Keep spotlights for near, in-view artworks only (overlaps with culling).

### H. InstancedMesh emitter discs (future)

- 30 separate `CircleGeometry` discs → one instanced mesh; marginal vs fixtures.

### I. Merge legacy `drawFrame` (future)

- Could combine black + white into one geometry with groups; only 9 paintings in default gallery.

### J. Quality toggle in pause menu (future)

- Wire `?quality=` to UI; optional shadow / MSAA tiers.

### K. Skip distant artwork physics (future)

- Static Rapier cuboids only for paintings near walkable cells; marginal CPU win.

### L. Bug fixes that enabled culling

- **`clone(false)` NaN bug:** dropped GLB children → empty bbox → NaN light positions → no illumination. Fixed with `cloneFixtureWithSharedAssets` (now instancing).
- **Pointer lock:** use `renderer.domElement`, not first `canvas` (minimap).

---

## Success criteria

- Met gallery: at most **8** spotlights active at once while walking.
- Fixtures: **3 draw calls** total (instanced GLB layers), not 30 × 3.
- Frames (JSON mode): **2 draw calls** per painting, not 8.
- Retina laptops: lower default fill cost on heavy galleries.
- All unit tests pass.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-11 | **Phase 1:** `updateSpotlightCulling()`; shared fixture geometry; `resolveMaxPixelRatio()`; unit tests. |
| 2026-07-11 | **Cull iterations:** view scoring, minimap, pointer-lock fix, emitter-only dimming, then all-lights-on regression. |
| 2026-07-11 | **Light debug:** cone helpers, solo fill, `galleryDebugSpotlights()`, `?debugLights=1`. |
| 2026-07-11 | **NaN fix:** `clone(false)` dropped GLB children; valid positions restored. |
| 2026-07-11 | **Cull v4:** frustum + wall occlusion; max 8 active lights; hide culled fixtures/emitters. |
| 2026-07-11 | **InstancedMesh fixtures** + **merged frame geometry** (8→2 draw calls); doc expanded with full strategy list. |
| 2026-07-11 | **InstancedMesh fix:** GLB parent `spotlight002` has 100× scale — bake hierarchy into geometry; mount proxy keeps full tree for wall-flush bbox. |
