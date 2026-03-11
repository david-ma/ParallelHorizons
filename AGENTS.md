# Agent notes: gallery project

This file is for AI agents (and maintainers) working on this codebase. It summarizes what the project is, how it’s structured, and things to watch for.

---

## What this is

**Gallery** is a 3D in-browser “digital twin” of a photography exhibition. Visitors move through a WebGL/Three.js space (WASD + mouse, pointer lock), with artwork on the walls. The current incarnation is **David Ma’s “Parallel Horizons”** show (from Tap Gallery), built on code originally by **OwlSketch**, which was an automated Met Museum–style gallery (search artist → scrape Met → build gallery).

- **Live**: [https://www.david-ma.net/gallery](https://www.david-ma.net/gallery)
- **Class use**: Example for Monash CDS2704 – Web design, S1 2023

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

```
gallery/
├── index.js              # Entry: loads config, express app, listens on port
├── config/
│   ├── config.js         # Dispatches to env-specific config
│   ├── express.js        # Express app: static at /gallery, body-parser
│   └── env/
│       ├── development.js
│       └── production.js
├── public/               # Served at /gallery
│   ├── index.html        # Shell: menu, canvas, scripts
│   ├── css/index.css
│   ├── js/
│   │   ├── main.js       # Core: gal object, scene, controls, paintings, movement
│   │   ├── three.module.js, PointerLockControls.js, GLTFLoader.js, etc.
│   │   └── gamepadtest.js, soundcloud-api.js, ...
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

1. **Route and static serving**  
   In `config/express.js`, `express.static('public')` is mounted at `/gallery`. There is also `app.get('/gallery', ...)` that does `res.sendFile(path.join(__dirname, '/index.html'))`. `__dirname` is `config/`, so that path is **wrong** (it would try to send `config/index.html`, which doesn’t exist). In practice, requests to `/gallery` or `/gallery/` are usually handled by the static middleware and `public/index.html` is served, so the bug may not show until the explicit route is hit (e.g. exact `/gallery` with no trailing slash, depending on Express ordering). Fix: send `path.join(__dirname, '../public/index.html')` or remove the route and rely on static + default index.

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

## Quick run (with Express)

```bash
npm install
npm start
# Open http://localhost:8888/gallery
```

Default port is 8888 (development config).
