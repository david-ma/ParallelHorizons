# Legacy assets archive note

Pre-Thalia demos and vendored Three.js bundles were **removed** from `public/` on 2026-08-11. The live site is served only via Thalia Handlebars + `src/js/` TypeScript.

## Removed

| Path | Was |
|------|-----|
| `public/index.html` | Standalone Express-era gallery entry |
| `public/screensaver/`, `public/statue/`, `public/wave/` | Old WebGL experiments |
| `public/js/three.js`, `three.min.js`, `three.module.js` | Vendored Three.js (viewer uses npm `three@0.183`) |
| `public/js/GLTFLoader.js`, `PointerLockControls.js`, `newPointerLockControls.js` | Legacy loaders/controls |
| `public/3d/cesar/` | Statue demo GLTF |

## Kept (still used)

| Path | Used by |
|------|---------|
| `public/js/Detector.js` | `/view` WebGL check (`gallery.hbs`) |
| `public/js/gamepadtest.js` | Dev gamepad overlay |
| `public/css/index.css` | All pages |
| `public/img/`, `public/models/` | Demo artworks, floor texture, spotlight GLB |
| `public/gallery-floorplan.json` | Demo layout until DB persistence |

## Still elsewhere (not removed)

- `system_programs/python/` — original Met scraper; not part of Thalia routes
- `public/img/OldArtworks/` — legacy scraper metadata

Recover deleted files from git history before this cleanup if needed.
