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

- 30 separate `CircleGeometry` discs → one instanced mesh; marginal vs fixtures but easy win.

### I. Merge legacy `drawFrame` (future)

- Could combine black + white into one geometry with groups; only 9 paintings in default gallery.

### J. Quality toggle in pause menu (future)

- Wire `?quality=` to UI; optional shadow / MSAA tiers.
- **`WebGLRenderer({ antialias: true })` + high DPR** is fill-rate heavy on Lambert + spots — expose MSAA off at `?quality=low`.

### K. Skip distant artwork physics (future)

- Static Rapier cuboids only for paintings near walkable cells; marginal CPU win.

### L. Bug fixes that enabled culling

- **`clone(false)` NaN bug:** dropped GLB children → empty bbox → NaN light positions → no illumination. Fixed with `cloneFixtureWithSharedAssets` (now instancing).
- **Pointer lock:** use `renderer.domElement`, not first `canvas` (minimap).

### M. Spotlight cull CPU (future — high payoff)

- `updateSpotlightCulling()` runs every frame: up to **30 rigs × frustum check × wall-occlusion raycast**.
- Likely CPU hotspot in Met gallery; profile before more GPU tweaks.
- Mitigations: cache occlusion per rig for N frames, spatial index for walls, skip raycast when not in padded FOV.

### N. Painting textures (future)

- 30 unique textures → 30 GPU binds + memory.
- Texture atlas or shared loader cache; optional max dimension per `?quality=`.

### O. Merge wall segments (future)

- Fewer draw calls when many floorplan cells are active.

### P. Phase profiling module (planned — see Telemetry below)

- `src/js/perf.ts` — rolling stats, slow-frame ring buffer, `galleryDumpPerf()` for agent-readable output.

---

## Next optimisations (priority order)

Product-side wins (A–D) are largely done. Further gains depend on **measuring where time goes** before changing more code.

| Priority | Change | Why |
|----------|--------|-----|
| **High** | Phase profiling in render loop | Unknown split between culling, physics, legacy collision, and `renderer.render`. |
| **High** | Reduce spotlight cull raycasts (M) | Up to 30 occlusion checks × all walls, every frame. |
| **Medium** | Instanced emitter discs (H) | 30 meshes → 1 instanced draw call. |
| **Medium** | Painting texture strategy (N) | Fewer binds and lower GPU memory. |
| **Medium** | MSAA / antialias tier (J) | Fill rate on Retina with Lambert + dynamic spots. |
| **Low–medium** | Merge wall geometry (O) | Draw calls in large floorplans. |
| **Future** | Baked probes / lightmaps (G) | Fragment lighting on distant walls. |
| **Skip** | Fixture poly reduction (F) | 660 tris instanced is not the bottleneck. |

Real enemies remain: **dynamic spotlights × Lambert walls**, **fill rate (DPR + MSAA)**, and **browser/GPU throttling** (e.g. Chrome Energy Saver caps rAF — see diary). Ceiling/wall textures are not the story.

---

## Telemetry and profiling

Goal: lightweight, privacy-conscious measurement so we can answer “how fast, on what setup, where is time spent?” without guessing or flooding logs.

### What we track today

| Metric | Source | Notes |
|--------|--------|-------|
| FPS (current) | `framerate()` in `main.ts` | Dev only; updates `#fps` every ~15 frames |
| Spotlight state | Minimap, `?debugLights=1`, `galleryDebugSpotlights()` | Active/lit/hold/fade; not timed |
| Minimap | `minimap.ts` | Visual only |

### What we do not track yet

| Metric | Source (when built) |
|--------|---------------------|
| FPS avg / min / p95 | Rolling buffer in `perf.ts` |
| Frame time ms | `performance.now()` delta per frame |
| Phase breakdown | Timers around render-loop sections |
| Draw calls, triangles, textures | `renderer.info.render` / `renderer.info.memory` |
| JS heap | `performance.memory` (Chrome; omit elsewhere) |
| Load timings | Floorplan fetch, Rapier init, GLB parse, first frame |
| Slow-frame capture | Ring buffer, JSONL export |

Refactor candidate: extract `framerate()` into `src/js/perf.ts` (noted in diary).

### Tier 1 — Dev HUD (always on in dev, no logs)

Extend `#devonly` / `#fps` with cheap on-screen fields only:

- FPS current + **1 s rolling avg and min**
- Frame time ms
- Draw calls, triangles (`renderer.info.render`)
- Geometries, textures (`renderer.info.memory`)
- Scene counts: paintings, walls, rigs, **lit** (`beamFade > 0`), **active** (cap-selected)
- DPR, viewport, gallery slug, `?quality=` value
- Chrome: heap used MB (graceful omit on Safari/Firefox)

Answers “how bad is it?” with zero disk/network noise.

### Tier 2 — Slow-frame capture (agent-readable, low noise)

**Do not log every frame.** Record only frames that exceed an adaptive budget:

```text
slow if frameMs > max(20, rollingMedianMs × 1.75)
```

At 120 Hz, 20 ms can be normal; at 60 Hz the target is ~16.7 ms. Multiplying the rolling median adapts to refresh rate and Energy Saver throttling.

#### Render-loop phases to time

Instrument `main.ts` `render()` when `GALLERY_DEV_TOOLS` or `?profile=1`:

| Phase key | Code |
|-----------|------|
| `anim` | `animatedObjects.forEach` |
| `move` | `updateVelocityOnly` + `stepPhysics`, or legacy `updateMovement` + collision |
| `spotCull` | `updateSpotlightCulling` |
| `minimap` | `updateDevMinimap` |
| `debug` | `updateSpotlightDebug` |
| `render` | `renderer.render` |

Read `renderer.info` **after** render. True GPU timing needs Chrome Performance or `EXT_disjoint_timer_query` (fragile); CPU phase split + draw calls is enough to pick the right lever most of the time.

Also time **one-off loads** separately (floorplan, textures, Rapier, GLB) — first-visit spikes are often mistaken for runtime jank.

#### Slow-frame JSONL schema

One compact JSON object per line (`ev: slow_frame`). Paste into chat or `grep slow_frame logs/...` for agent analysis.

```json
{"ev":"slow_frame","ts":12450,"frameMs":31.2,"budgetMs":16.7,"phases":{"anim":0.1,"move":0.4,"spotCull":14.2,"minimap":0.6,"debug":0.2,"render":15.1},"render":{"calls":187,"tris":12400,"tex":34},"lights":{"total":30,"active":8,"lit":9,"hold":2},"scene":{"paintings":30,"walls":48},"cam":{"x":12.1,"y":1.75,"z":-4.2},"dpr":1.25,"gallery":"met-monet"}
```

| Field | Purpose |
|-------|---------|
| `phases` | Which subsystem to optimise |
| `render.calls/tris/tex` | GPU load proxy |
| `lights` | Correlates with Lambert fragment cost |
| `cam` | Reproduce viewpoint |
| Short keys | Fewer tokens when pasted to an agent |

**Ring buffer:** keep last **20–50** slow frames in memory. Expose on `globalThis`:

- `galleryDumpPerf()` — print JSONL + copy to clipboard
- `galleryPerfSummary()` — p50/p95 frame ms, slow count, phase totals

Enable detailed capture only with **`?profile=1`** (auto-stop after ~60 s + one summary line). No continuous logging in normal dev.

#### Noise rules

| Do | Don't |
|----|-------|
| Ring buffer of slow frames only | `console.log` every frame |
| `?profile=1` for timed walkthroughs | Verbose logging in production |
| Fixed-schema one-liners | Multi-kB pretty-printed dumps |
| `galleryDumpPerf()` on demand | Stream thousands of lines into chat |
| Session aggregates every few minutes | Per-painting/per-light arrays unless debugging lights |

### Tier 3 — Session snapshot (optional, rare)

On load complete, pointer-lock exit, or every ~5 min while active — **one** aggregate JSON (not per-frame):

```json
{
  "ev": "gallery.session",
  "ts": "2026-07-11T06:13:00.000Z",
  "gallery": { "slug": "met-monet", "artworks": 30, "activeCells": 16 },
  "perf": {
    "fpsAvg": 58,
    "fpsMin": 42,
    "frameTimeP95Ms": 22,
    "drawCalls": 140,
    "triangles": 8200,
    "textures": 12,
    "heapUsedMb": 85,
    "slowFrameCount": 12
  },
  "client": {
    "browser": "Chrome",
    "platform": "MacIntel",
    "dpr": 2,
    "viewport": { "w": 1920, "h": 1080 },
    "webglRenderer": "ANGLE (Apple, …)"
  }
}
```

**Thalia route (future):** `POST /telemetry/gallery` → append to `logs/gallery-telemetry.jsonl` in dev; rate-limit; no PII beyond coarse UA-derived browser name. Use for **cross-browser comparison** (Chrome vs Safari vs Cursor), not per-frame debugging.

Privacy: opt-in or anonymous-only until policy covers it; 90-day retention for raw events; roll up to daily medians per browser × artwork-count bucket.

---

## Debug workflow (3D gallery)

```text
1. Reproduce on target gallery + browser (/view/met-monet)
2. Dev HUD: avg/min FPS, frame ms, draw calls, lit lights
3. Still bad? → ?profile=1, walk a fixed path for 30–60 s
4. galleryDumpPerf() → JSONL
5. Read phases:
   - spotCull high  → raycasts, eligibility, cap logic (M)
   - render high    → lights, DPR, MSAA, materials, overdraw (D, J, G)
   - move high      → legacy collision vs Rapier path
6. A/B bisect with query params; re-measure same camera path
7. Update this doc + changelog with evidence
```

### A/B toggles (dev query params)

| Toggle | Isolates |
|--------|----------|
| `?quality=low` | Fill rate / DPR / (future) MSAA |
| `?debugLights=1` + solo fill | Spotlight vs ambient contribution |
| Skip minimap/debug (future flag) | 2D overlay CPU |
| Force all lights vs cap 8 (future) | Dynamic light shading cost |
| Disable occlusion rays (future) | Cull CPU raycast cost |

Use the **same walk** each run (e.g. north corridor → turn → back). Compare `galleryPerfSummary()` numbers, not subjective feel alone.

### Human deep dive (not for agents)

- **Chrome:** Performance panel → record 3 s while walking; look for long `updateSpotlightCulling` or shader compile spikes.
- **Safari:** Web Inspector → Timelines.
- **GPU throttling:** `chrome://gpu`, Energy Saver, display refresh — diary notes Chrome ~30 FPS until Energy Saver off.

---

## Telemetry build todo

- [x] `src/js/perf.ts` — rolling frame stats, phase timers, slow-frame ring buffer
- [x] Instrument `main.ts` render — six phase marks; read `renderer.info` after render
- [x] Dev overlay — extend `#fps` with avg/min ms, draw calls, lit lights
- [x] `galleryDumpPerf()` / `galleryPerfSummary()` on `globalThis`
- [x] `?profile=1` — enable JSONL capture for 60 s then auto-off + summary
- [ ] Time one-off loads (floorplan, Rapier, GLB, textures)
- [ ] `POST /telemetry/gallery` → `logs/gallery-telemetry.jsonl` (dev only)
- [ ] Document final schema in `docs/telemetry-schema.md` when implemented
- [ ] Cross-browser session snapshots once Tier 1 HUD exists (Chrome / Safari / Cursor)

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
| 2026-07-11 | **Telemetry plan:** Tier 1 HUD, Tier 2 slow-frame JSONL + `galleryDumpPerf()`, Tier 3 session snapshots; debug workflow and build todo added to this doc. |
| 2026-07-11 | **`perf.ts` shipped:** phase timers, slow-frame ring buffer, dev HUD, `?profile=1`, `galleryDumpPerf()` / `galleryPerfSummary()`. |
