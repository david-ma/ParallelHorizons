# Agent notes: gallery project

This file is a practical handoff for maintainers and coding agents.

### Changelog (short)

| Date       | Change |
|------------|--------|
| 2025-03-12 | Rapier physics: wall/floor collision via `@dimforge/rapier3d-compat`; `physics.ts` (init, createGalleryPhysics, stepPhysics); WASD/camera-relative movement (forward/right in view direction). |
| 2025-03-12 | Split `main.ts` into modules: `types.ts`, `artwork.ts`, `layout.ts`, `spotlight.ts`, `gallery.ts`, `movement.ts`; main.ts is entry + boot/pointer lock/render loop. |
| 2025-03-12 | AGENTS.md: added changelog, summary, roadmap, and resource links. Create page: dark mode (Charcoal Studio), scrollable Photos sidebar. |
| 2025-03-12 | Create page: overflow scroll on Photos list; Charcoal Studio palette from `thalia_ubc/src/colours.hbs`. |
| 2025-03-12 | View: JSON-driven artworks get black frame + white inner moulding; fixed frame/moulding overlap. |
| 2025-03-12 | View: load floorplan from `public/gallery-floorplan.json` when present; dynamic walls + placements; fallback to hardcoded layout. |
| 2025-03-12 | Create: D3 5×5 grid; drag/drop onto any wall; multi-photo per cell; thumbnails on grid; export/import/download JSON. |
| 2025-03-12 | Gallery creation page at `/create`; `gallery_creation.hbs` + `gallery_creation.ts`; floorplan JSON schema v2. |
| 2025-03-11 | Spotlight sliders: Export JSON button; Light X; emitter X/Y/Z relative to spotlight; Wall Offset range widened; Spotlight Z label. |
| 2025-03-11 | Dev modal on bottom-right; Esc shows menu; classList for hide/show; z-index for menu/canvas. |
| 2025-03-11 | Spotlight: one fixture + light; GLB from Poly Pizza (iPoly3D, CC0); wall-mounted; emitter disc “on” look; credits in README + index. |
| 2026-07-11 | Async floorplan load (`loadFloorplanAsync`), loading overlay, `buildMinimalGallery` fallback, sample `gallery-floorplan.json`, schema doc, per-artwork spotlights in JSON mode. |
| 2026-08-11 | Legacy `public/` demos removed; homepage refresh; Phase 1 plan (`docs/2026-08-11_phase1_smugmug_and_auth.md`); unit tests; pause menu 1 FPS power save. |

---

## Project status (current)

The gallery is now running as a Thalia website and no longer depends on the old Express app flow for normal development.

### Completed foundation work

- Thalia config and routes are in place in `config/config.ts`.
- `/` renders homepage (`src/index.hbs`).
- `/view` renders gallery page from Handlebars (`src/gallery.hbs`), not `public/index.html`.
- Client runtime is TypeScript in `src/js/`:
  - `src/js/main.ts` — entry: boot, pointer lock, create/render delegates
  - `src/js/types.ts` — `Gal` interface, `FloorplanBlob` / `FloorplanWallPlacements`
  - `src/js/artwork.ts` — `drawFrame`, `addFrameToArtwork` (frames and moulding)
  - `src/js/layout.ts` — `loadFloorplanAsync`, `buildSceneFromFloorplan`, `buildMinimalGallery` (JSON layout → scene)
  - `src/js/spotlight.ts` — spotlight rig (add/apply), dev slider bindings + export
  - `src/js/gallery.ts` — `buildDefaultGallery` (hardcoded floor/walls/paintings + one spotlight)
  - `src/js/movement.ts` — `attachMovementKeys`, `updateVelocityOnly`, `updateMovement` (WASD camera-relative + velocity)
  - `src/js/physics.ts` — Rapier: `initRapier`, `createGalleryPhysics`, `stepPhysics` (floor/walls/player body)
  - `src/js/gamepadtest.ts`, `src/js/Detector.ts`
- Three.js is upgraded to npm package `three@0.183.2`.
- Type-check path is working (`bunx tsc --noEmit`) with `typescript` and `@types/three`.

### Completed 3D viewer improvements

- Spotlight fixture model support added (`/public/models/spotlight/Spotlight.glb`).
- Dev spotlight tuning UI added via partial (`src/partials/spotlight_sidebar.hbs`).
- Live spotlight updates in-scene from sliders.
- Export button copies spotlight tuning JSON.
- Pointer-lock/menu behavior improved (Esc/menu re-entry flow, modal visibility fixes).

### Completed floorplan tooling

- Floorplan builder page at `/create` (`src/gallery_creation.hbs` + `src/js/gallery_creation.ts`).
- D3 5x5 grid editor with:
  - cell activation
  - drag/drop photos
  - multi-photo placements per wall (`north/east/south/west`)
  - thumbnail previews drawn on wall bands
  - JSON export/import/download
- `/view` now supports loading layout from `public/gallery-floorplan.json`.
- If no JSON exists (or invalid), `/view` falls back to current hardcoded gallery layout.

### Completed physics and movement

- **Rapier** (`@dimforge/rapier3d-compat`): async init, then world with floor + wall colliders (from `wallGroup`) and dynamic player body; pointer-lock path uses `updateVelocityOnly` + `stepPhysics` for sliding and no walk-through-walls; screensaver path keeps legacy movement.
- **WASD / arrows** are camera-relative: forward/back/left/right in the direction the camera is facing (XZ plane); same for gamepad analog stick; applies to both physics and non-physics paths.

### Completed artwork framing in JSON mode

- JSON-driven artworks now include:
  - black outer frame
  - white inner moulding/mat
- Frame overlap issue was fixed so moulding and frame do not occupy the same band.

---

## Current plan (near-term)

1. ~~Stabilize JSON schema and document it as the contract between `/create` and `/view`.~~ → `docs/floorplan-schema.md`
2. ~~Replace synchronous JSON load in `layout.ts` with an async load + loading state.~~
3. (Done) JSON gallery-build logic lives in `layout.ts`; legacy fallback in `gallery.ts`.
4. Apply tuned spotlight settings from one fixture to all generated fixtures when requested.
5. ~~Add basic placards (title/artist/year) support in JSON and render beside artworks.~~

---

## Future roadmap / features

### Phase A: data model + rendering architecture

- Introduce explicit classes where useful:
  - `Artwork` (mesh, frame, moulding, placard metadata) — currently helpers in `artwork.ts` + usage in `layout.ts`/`gallery.ts`
  - `SpotlightRig` already in `spotlight.ts`; `GalleryLayout` (JSON parsing/validation + runtime world builder) partially in `layout.ts`
- Add schema versioning + migration helpers (`v1`/`v2` compatibility).

### Phase B: user features

- User auth/authorization with Thalia security.
- User dashboard for gallery creation/editing.
- Upload flows with UploadThing.
- Save floorplans/layouts to DB instead of file export.

### Phase C: richer scenes

- Placeable 3D objects (statues/props) from JSON.
- Collision for placed objects (not just walls).
- Public share links for read-only visitor mode.
- Placards/labels and click/inspect overlays.
- Optional ambient audio/music per gallery.

---

## JSON layout notes (current)

`/create` currently emits/uses a wall-aware JSON shape:

- `grid`: rows/cols
- `activeCells`: array of `"row,col"`
- `placements`: map of cell key to wall arrays
  - `north`, `east`, `south`, `west` -> `string[]` of photo ids
- `photoCatalog`: `{ id, title, src }[]`

`/view` consumes `public/gallery-floorplan.json` when present and builds walls/art placement from this data.

---

## Key files to know

- Routing/config:
  - `config/config.ts`
- Viewer modules (`src/js/`):
  - `main.ts` — entry, boot, pointer lock, create/render; async Rapier init then physics-driven or legacy movement
  - `physics.ts` — Rapier world, floor/wall colliders, player body, step + camera sync
  - `layout.ts` — load + build from floorplan JSON
  - `gallery.ts` — default (hardcoded) gallery
  - `artwork.ts` — frames/moulding
  - `spotlight.ts` — rig + dev sliders
  - `movement.ts` — keys + camera-relative velocity (forward/right from camera quaternion)
  - `types.ts` — shared types
- Public pages:
  - `src/index.hbs`
  - `src/gallery.hbs`
  - `src/gallery_creation.hbs`
- Floorplan editor:
  - `src/js/gallery_creation.ts`
- Spotlight controls partial:
  - `src/partials/spotlight_sidebar.hbs`

---

## Code notes (implementation details)

- **Camera-relative movement** (`movement.ts`): Forward = camera look direction flattened to XZ; right = `dir × up` (right-hand rule). Use **dir×up** for right so A/D map to left/right; **up×dir** would flip them.
- **Physics vs legacy**: In `main.ts` render, `usePhysics = g.physicsWorld && g.playerBody && !g.screensaver`. When true we call `updateVelocityOnly` + `stepPhysics` (Rapier); else `updateMovement` (velocity + manual wall collision + PointerLockControls moveForward/moveRight).
- **Rapier**: Used only with pointer lock. Screensaver keeps legacy movement. Floor top at y=1.25, player center 1.75; walls built from `g.wallGroup` (world matrix + BoxGeometry params).

---

## Useful skills / docs / references

### Local skill docs

- Thalia skill: `/usr/local/dev/scripts/skills/thalia_skill.md`
- Thalia UploadThing skill: `/usr/local/dev/scripts/skills/thalia_uploadthing_skill.md`
- Thalia Security skill: `/usr/local/dev/scripts/skills/thalia_security_skill.md`
- Cursor create-rule skill: `/Users/david/.cursor/skills-cursor/create-rule/SKILL.md`

### Design reference used

- Charcoal Studio palette reference:
  - `/usr/local/dev/ubc/thalia_ubc/src/colours.hbs`

### External references

- Three.js docs: [https://threejs.org/docs/](https://threejs.org/docs/)
- Three.js npm package: [https://www.npmjs.com/package/three](https://www.npmjs.com/package/three)
- D3 docs: [https://d3js.org/](https://d3js.org/)
- Poly Pizza spotlight model source: [https://poly.pizza/m/YohOCmn0hO](https://poly.pizza/m/YohOCmn0hO) (CC0, iPoly3D)

### Example code in repo

- Spotlight rig + tuning:
  - `src/js/layout.ts` (`loadFloorplan`) and `main.ts` (`create()` calls it)
- JSON floorplan editor behavior:
  - `src/js/gallery_creation.ts`
- Dev spotlight tuning UI:
  - `src/partials/spotlight_sidebar.hbs`

---

## Quick run

From Thalia repo (gallery linked under `websites/`):

```bash
cd /usr/local/dev/Thalia
bun run bin/develop.ts gallery
```

Then open:

- `/` homepage
- `/view` 3D gallery
- `/create` floorplan editor

