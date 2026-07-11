# Gallery performance optimisations — 2026-07-11

## Problem

The **Monet at the Met** gallery (`/view/met-monet`) places **30 paintings**, each with a real-time `SpotLight`, emitter disc, and cloned GLB fixture. Parallel Horizons has **9**. Profiling and code review pointed to:

| Factor | Impact | Notes |
|--------|--------|-------|
| **30 dynamic SpotLights** | **Critical** | Lambert walls evaluate lighting per fragment; lights are not frustum-culled |
| Draw calls (~330+ when crowded) | High | Separate frame/placard meshes; 30 fixtures × 3 material groups |
| 30 deep-cloned GLB fixtures | Medium | Duplicated GPU geometry buffers (~660 tris each) |
| MSAA + pixel ratio 2 | Medium | Heavy on Retina Chrome/Safari |
| Spotlight mesh complexity | Low | 660 tris/fixture — not the bottleneck |
| Rapier physics | Low | One dynamic player body; paintings are static AABBs only |
| Off-screen meshes | Already OK | Three.js frustum culling (default) |

Browser variance (Chrome/Safari vs Firefox/Cursor) is partly GPU throttling (Energy Saver) and partly fill-rate when many lit surfaces are on screen.

---

## Plan

### Phase 1 — implement now

1. **Proximity spotlight culling** (`src/js/spotlight.ts`)
   - Each frame, enable only the **N closest** spotlights (and their fixtures/emitter discs).
   - `N = paintingCount` when ≤ 8; else **8** (6 if count ≥ 24).
   - Disabled lights: `visible = false` so Three.js drops them from the lighting pass.

2. **Shared fixture geometry** (`src/js/spotlight.ts`)
   - Change `template.clone(true)` → `template.clone(false)` so all fixtures share one GLB’s buffers.

3. **Adaptive renderer quality** (`src/js/main.ts`)
   - Cap `devicePixelRatio` at **1.25** when `num_of_paintings ≥ 20`, else **2**.
   - URL override: `?quality=low` → cap at **1**; `?quality=high` → cap at **2**.

4. **Unit tests** for culling selection + pixel-ratio helper (`tests/unit/spotlight.test.ts`).

### Phase 2 — later (not in this pass)

- `InstancedMesh` for identical fixtures (one draw call).
- Merge frame/moulding geometry per artwork.
- Light probe or baked ambient for far walls; keep spotlights near camera only.
- Optional quality toggle in pause menu.
- Skip artwork Rapier colliders beyond walkable range (marginal).

---

## Success criteria

- Met gallery: at most **8** spotlights active at once while walking.
- Fixture GPU memory: **one** shared geometry set, not 30 copies.
- Retina laptops: lower default fill cost on heavy galleries.
- All existing unit tests pass; new tests cover culling helpers.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-11 | **Phase 1 done:** `updateSpotlightCulling()` — max 8 lights (6 when ≥24 paintings); `template.clone(false)` for shared fixture geometry; `resolveMaxPixelRatio()` — cap 1.25 on heavy galleries, `?quality=low\|high` override; 7 new unit tests. |
| 2026-07-11 | **Cull fix:** refresh artwork world position each frame; view-direction scoring + 8 m near boost; restore `intensity` when re-enabling; cap heavy galleries at 8 active lights; use `registeredRigs.length` not `num_of_paintings`. |
| 2026-07-11 | **Cull v2 + minimap:** pure nearest-distance selection; dev-only top-right minimap (floorplan, player, paintings, active spotlights) on localhost. |
| 2026-07-11 | **Cull v3:** in-view beam selection; fixtures always visible; beam-only toggle; fix pointer lock on WebGL canvas (not minimap canvas); minimap view wedge + in-view colours. |
