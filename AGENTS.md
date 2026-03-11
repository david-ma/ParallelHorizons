# Agent notes: gallery project

This file is for AI agents (and maintainers) working on this codebase. It summarizes what the project is, how it’s structured, and things to watch for.

---

## What this is

**Gallery** is a 3D in-browser “digital twin” of a photography exhibition. Visitors move through a WebGL/Three.js space (WASD + mouse, pointer lock), with artwork on the walls. The current incarnation is **David Ma’s “Parallel Horizons”** show (from Tap Gallery), built on code originally by **OwlSketch**, which was an automated Met Museum–style gallery (search artist → scrape Met → build gallery).

- **Live**: [https://www.david-ma.net/gallery](https://www.david-ma.net/gallery)
- **Class use**: Example for Monash CDS2704 – Web design, S1 2023

**Direction:** Convert to a **Thalia-based** service where users can upload their own photos, describe gallery layout and placement, and generate navigable 3D galleries. Auth and uploads via Thalia security and UploadThing (see skill files under `/usr/local/dev/scripts/skills/`).

---

## Vendor code / Three.js (no Thalia change)

We **do not** add a `config.vendor` (or similar) to Thalia. Rationale:

- **Client-side deps:** The 3D app needs Three.js in the browser. Options are: (1) copy/symlink a built file from `node_modules/three` into `public/`, or (2) bundle our app so `three` is included in the output.
- **Chosen approach:** Gallery uses **npm `three`** and Thalia’s built-in **TypeScript handler**. In development, a request to `/js/main.js` triggers Bun to compile and serve `src/js/main.ts` (into `dist/js/main.js`), so there is **no manual build step required** when running under Thalia.
- **Why not Thalia config.vendor:** A generic “copy these npm paths into public” would help other sites but adds API surface and behaviour (when to copy, where, how to name). Keeping it **project-level** (each site that needs vendor JS uses a script or a bundler if it wants static export) avoids framework complexity and breaking changes. If several Thalia projects later need the same pattern, we can revisit a small convention (e.g. optional `scripts.vendor` or a one-line doc in the Thalia skill).

**Gallery specifics:** `package.json` has `"three": "0.183.2"`. Thalia compiles `src/js/main.ts`, `src/js/Detector.ts` and `src/js/gamepadtest.ts` on-the-fly to `dist/js/*.js` when `/js/*.js` is requested in development. For a static export (e.g. GitHub Pages), we can add a one-off `build:js` script later that writes a bundle into `public/js/`, but this is **not** required for normal Thalia usage.

---

## Thalia gallery roadmap (prioritised)

Reference: `thalia_skill.md`, `thalia_uploadthing_skill.md`, `thalia_security_skill.md` in `/usr/local/dev/scripts/skills/`.

### Phase 1 — Thalia conversion (do first)

| # | Task | Notes |
|---|------|------|
| 1.1 | **Remove Express** | Delete `index.js`, `config/express.js`, `config/config.js`, `config/env/`. Drop `express` and `body-parser` from `package.json`. |
| 1.2 | **Add Thalia project structure** | Create `config/config.ts` (Thalia config), `src/` with Handlebars templates. Serve `public/` at root; homepage introduces the service. |
| 1.3 | **Register as Thalia website** | Symlink repo into `Thalia/websites/gallery` (or add to Thalia’s website list) so `bun dev gallery` runs the site. |
| 1.4 | **Asset paths** | Front end currently uses `/gallery/` prefix. With Thalia serving the project at its own domain/path, switch to root-relative paths (e.g. `/js/`, `/img/`) or a single base path so the 3D viewer and assets load correctly. |

### Phase 2 — Auth and user galleries

| # | Task | Notes |
|---|------|------|
| 2.1 | **Thalia security** | Use `ThaliaSecurity` + `RoleRouteRule` (see `thalia_security_skill.md`). Roles: guest (homepage, public gallery view), user (own dashboard, upload, edit), admin. |
| 2.2 | **Homepage** | Public landing: explain the service, link to “Create gallery” / “Log in”. |
| 2.3 | **Secure “my gallery” dashboard** | Protected route for logged-in users: list their galleries, create new gallery, upload photos, annotate artworks, define layout. |
| 2.4 | **UploadThing integration** | Per `thalia_uploadthing_skill.md`: browser → UploadThing, then server-side processing if needed. Use for user photo uploads; optional cleanup/tagging for temp files. |

### Phase 3 — Gallery model and 3D engine

| # | Task | Notes |
|---|------|------|
| 3.1 | **Gallery + layout as data** | Store per-user galleries (e.g. Drizzle). **Layout/placement**: JSON blob describing room(s), wall positions, which art goes where (image URL, position, optional caption). Ingest this when rendering the 3D view. |
| 3.2 | **Refactor main.js → TypeScript** | Rewrite in TS: modular, reusable. Entry point builds scene from **layout JSON** (not hardcoded 30 images). Keep behaviour: pointer lock, WASD, collision (walls), raycast for artwork click. |
| 3.3 | **Upgrade Three.js to r183** | Replace vendored r120 with current r183; update imports and any deprecated APIs. Use ES modules + npm or CDN. |
| 3.4 | **3D viewer API** | Single entry (e.g. `viewer.ts` or `main.ts`) that: loads layout JSON, creates scene (floor, walls, art from URLs), runs render loop and controls. Used by “View gallery” from dashboard and by public gallery links. |

### Phase 4 — Features and polish

| # | Task | Notes |
|---|------|------|
| 4.1 | **Descriptions / labels** | In dashboard: let users add title/caption per artwork. In 3D: raycast click on art → show overlay or panel with title/description. |
| 4.2 | **Dynamic floor layout** | Layout JSON describes room shape/size (e.g. rectangular, L-shaped); viewer builds floor and walls from that instead of a single fixed layout. |
| 4.3 | **Public gallery URLs** | Shareable link for a gallery (e.g. `/gallery/view/:id` or slug) that loads layout JSON and runs the 3D viewer (read-only; no edit). |

### Stretch goals (later)

| # | Task | Notes |
|---|------|------|
| S1 | **3D objects in scene** | Support placing 3D models (e.g. statue, GLTF) in the layout JSON; load with Three.js GLTFLoader. Existing `statue/` demo as reference. |
| S2 | **Collision for 3D objects** | Extend collision so the camera doesn’t pass through placed 3D objects (not just walls). |
| S3 | **Music / SoundCloud** | Optional background music per gallery (e.g. SoundCloud embed or URL in layout JSON). Reuse pattern from `wave/index.html` + `soundcloud-api.js`. |
| S4 | **Gamepad support** | Map gamepad axes/buttons to movement and look; optional for accessibility and big-screen use. Existing `gamepadtest.js` as reference. |
| S5 | **Mobile-friendly controls** | Touch-friendly navigation (virtual joystick or tap-to-move) so the 3D gallery is usable on phones/tablets. |

### Implementation order (summary)

1. **Phase 1** — Remove Express, add Thalia config and templates, serve at root; confirm site runs under Thalia.
2. **Phase 2** — Add security, homepage, dashboard, UploadThing for uploads.
3. **Phase 3** — Define gallery/layout schema and JSON format; refactor main.js to TypeScript + Three r183; viewer consumes layout JSON.
4. **Phase 4** — Labels, dynamic layout, public share URLs.
5. **Stretch** — 3D objects, collision, SoundCloud, gamepad, mobile.

---

## Tech stack

- **Back end**: Optional. The repo includes Node + Express, but the app is **fully static** — no APIs, no server logic. You can serve the `public/` folder with any static host (GitHub Pages, Netlify, nginx, etc.).
- **Front end**: Vanilla JS (ES modules), Three.js (vendored), jQuery (CDN), pointer-lock + keyboard/gamepad-style controls.
- **Assets**: Images under `public/img/` (Artworks, Textures, OldArtworks JSON metadata); optional 3D under `public/3d/`.
- **Tooling**: Python scrapers in `system_programs/python/` (Met scraper); C++ in `system_programs/cpp/` (e.g. `minAlgo.cpp`). No front-end build step in the main app.

---

## Dependencies

### npm (server only)

- **express** ^4.16.2 — static file serving.
- **body-parser** ^1.18.2 — not used by any route; can be removed if you drop Express.

### Front-end (browser)

| Dependency | Version / source | Where used | Notes |
|------------|------------------|------------|--------|
| **Three.js** | r120 (vendored) | `public/js/three.module.js`, `three.js`, `three.min.js` | Main 3D engine. REVISION = `'120'` in the module build. Old; current Three is r170+. |
| **jQuery** | 3.5.1 (CDN) | `index.html` | Loaded from `code.jquery.com`. Used only for: (1) `$("#fps").text(...)` in `main.js` and `gamepadtest.js`, (2) `$("#gamepadtest").toggleClass("devmode")` in inline script. Easy to replace with `document.querySelector` + `.textContent` / `.classList`. |
| **Detector.js** | Vendored | `index.html`, `main.js`, `wave/`, `statue/`, `screensaver/` | Legacy WebGL capability check (`Detector.webgl`). From old Three.js examples. |
| **PointerLockControls.js** | Vendored | `main.js` | Three.js addon for pointer-lock FPS controls. |
| **GLTFLoader.js** | Vendored | `statue/index.html` | Three.js GLTF loader; used by the statue/3D demo. |
| **soundcloud-api.js** | Vendored (minified) | **Only `public/wave/index.html`** | SoundCloud Widget API (`SC.Widget`). Used to control an embedded SoundCloud iframe (playlist) and bind events (READY, FINISH). **Not used by the main gallery** (`index.html`). |
| **gamepadtest.js** | Local | `index.html` | Gamepad test UI; uses jQuery for FPS display. |

### External (loaded at runtime)

- **Google Fonts**: Lato, Oswald — linked in `public/index.html`.

---

## Layout (high level)

After Thalia conversion (Phase 1):

```
gallery/
├── config/
│   └── config.ts         # Thalia: domains, controllers (homepage, static)
├── src/
│   ├── index.hbs         # Homepage template
│   ├── gallery.hbs       # 3D gallery viewer page (later)
│   └── partials/         # head.hbs, etc.
├── src/
│   └── js/
│       ├── main.ts       # Main 3D app; entry for `/js/main.js` (compiled to `dist/js/main.js` by Thalia)
│       ├── Detector.ts    # WebGL check (compiled on-the-fly by Thalia)
│       └── gamepadtest.ts # Gamepad UI (compiled on-the-fly by Thalia)
├── public/               # Served at root by Thalia
│   ├── index.html        # Shell: menu, canvas, scripts
│   ├── css/index.css
│   ├── js/
│   │   ├── main.js       # Served JS for viewer (compiled from src/js/main.ts during development)
│   │   ├── three.module.js, GLTFLoader.js, soundcloud-api.js  # Legacy/demos
│   ├── img/
│   │   ├── Artworks/     # 0.jpg … 29.jpg (used by main.js)
│   │   ├── Textures/     # Floor.jpg, etc.
│   │   └── OldArtworks/  # 0.json … 29.json (Met-style metadata; not wired in)
│   ├── 3d/               # e.g. cesar/scene.gltf
│   └── wave/, statue/, screensaver/  # Extra HTML “demos”
└── system_programs/      # Python scrapers, C++ util (not part of runtime)
```

---

## Behaviour worth knowing

1. **Routes (Thalia)**  
   `config/config.ts`: `''` → homepage (`src/index.hbs`), `view` → 3D app (`public/index.html`). Static files in `public/` are served at root (`/js/`, `/img/`, `/css/`). Asset paths in the 3D app are root-relative so they work when the page is served at `/view`.

2. **How paintings are loaded**  
   `public/js/main.js` expects exactly **30** images:  
   `/gallery/img/Artworks/0.jpg` … `29.jpg`.  
   It builds a fixed layout (two rows on opposite walls). The `public/img/OldArtworks/*.json` files are Met-style metadata and are **not** read by the current front-end; they’re leftovers from the OwlSketch scraper workflow.

3. **Paths in the front end**  
   Scripts and textures use the `/gallery/` prefix (e.g. `/gallery/js/three.module.js`, `/gallery/img/Textures/Floor.jpg`). So the app expects to be served either under the path `/gallery` or with those prefixes rewritten (e.g. base tag or find/replace to `/` if hosting at site root).

4. **Pointer lock and “screensaver”**  
   On desktop, clicking “PLAY” requests pointer lock and enables WASD + mouse. If pointer lock isn’t available (e.g. some mobile), a “screensaver” mode runs: camera drifts between preset positions on a timer.

5. **Mobile**  
   There’s a `#mobile_controls` block and a “mobile” branch in the pointer-lock logic, but the README still lists “Make it more mobile friendly” as a todo. Touch-friendly navigation is not fully there.

---

## README todos (for context)

- Clean up so it can run from the public folder
- Make it easier for others to change their images
- Add descriptions / labels for images
- Dynamic floor layout
- More mobile-friendly navigation

---

## Suggestions for future work

- **Fix the `/gallery` route** in `config/express.js` so it sends `public/index.html` (or drop the route and rely on static).
- **Unify image source**: Either document that only `Artworks/0.jpg`–`29.jpg` are used and OldArtworks JSON is legacy, or add a small pipeline (e.g. config or script) that maps from a list/metadata (including OldArtworks) to the 30 slots.
- **Image/config for non-devs**: README wants “easier for others to change their images” — consider a single config (e.g. `artworks.json`) listing image paths and optional labels, and have `main.js` read that instead of a fixed loop of 30.
- **Descriptions/labels**: Wire metadata (or a simple JSON) into the raycast/click UI so that clicking a painting shows title/description.
- **Tests**: `npm test` is a stub; adding even a few smoke tests (e.g. server up, static assets, or a minimal Three.js check) would help.
- **Dependencies**: `package.json` still points at the OwlSketch repo; consider updating author/homepage and locking Express/body-parser versions for security.

---

## Static hosting (no Express)

The app doesn’t need Node or Express. To run it as a static site:

1. **Serve the `public/` directory** so that the site is available at path `/gallery` (e.g. deploy `public/` as the contents of `your-domain.com/gallery/`). All asset paths already use `/gallery/`, so nothing to change.
2. **Or serve at site root**: Point your static host at `public/` as the document root, then replace every `/gallery/` with `/` in `public/index.html`, `public/js/main.js`, and any other files that reference `/gallery/` (see “Paths in the front end” above). Then the site works at `https://your-domain.com/`.

Examples:
- **Local static server**: `npx serve public` then visit `http://localhost:3000` — will 404 until you either mount at `/gallery` or do the path change above.
- **GitHub Pages** (repo root or `/docs`): Put `public/` contents in the served folder and set base path to `/gallery` or your repo name, or do the `/` path change and use repo as root.

---

## Quick run (Thalia)

```bash
# From Thalia repo; gallery must be linked under websites/
cd /usr/local/dev/Thalia && bun dev gallery
# Open http://localhost:1337 (or port shown in log)
```

Legacy (pre–Thalia): `npm install && npm start` then http://localhost:8888/gallery — to be removed in Phase 1.
