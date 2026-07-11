Gallery
===========

This is a digital twin of David Ma's first solo photography exhibition, using code originally written by OwlSketch.

This version of the gallery can be visited at [https://www.david-ma.net/gallery](https://www.david-ma.net/gallery).

I have uploaded this code as example code for the Monash class CDS2704 - Web design - S1 2023.


Quickstart (Thalia):

1. Clone the repository and symlink it into Thalia’s websites:  
   `ln -snf /path/to/gallery /path/to/Thalia/websites/gallery`
2. In the **gallery** repo: `bun install` (installs `three` so `src/js/main.ts` can import it).
3. From the Thalia repo: `bun run bin/develop.ts gallery`
4. Open the URL shown (e.g. `http://localhost:1339`):
   - `/` — homepage
   - `/view` — 3D walkthrough (loads `public/gallery-floorplan.json` when present)
   - `/create` — floorplan editor (export JSON for `/view`)

Thalia compiles `src/js/*.ts` → `/dist/js/*.js` on-the-fly in development.

**Scripts** (in this repo): `bun run typecheck`, `bun run dev`, `bun run start`.

Floorplan JSON contract: see [docs/floorplan-schema.md](docs/floorplan-schema.md).

## Status

Done:

- Thalia site: `/`, `/view`, `/create`
- TypeScript viewer modules, Three.js r183, Rapier physics
- JSON floorplan layout + async load + sample `gallery-floorplan.json`
- Placards (title/artist/year) on JSON artworks
- Floorplan editor at `/create`

Next (see [docs/2026-08-11_phase1_smugmug_and_auth.md](docs/2026-08-11_phase1_smugmug_and_auth.md)):

- Phase 1: Auth (Thalia security), SmugMug + UploadThing, photo library UI, DB-backed floorplans
- Mobile-friendly controls

Credits:
* Spotlight 3D model by [iPoly3D](https://poly.pizza/u/ipoly3d) from [Poly Pizza](https://poly.pizza/m/YohOCmn0hO) - License: CC0 (public domain)

-----------
Original README.md From @OwlSketch:
===========

Online automated art gallery based on your search input.

There is now a functional alpha version currently being hosted at [owlsketch.com/gallery](http://www.owlsketch.com/gallery)

This program is based on two programs. A python web scraper, that gets the images of your favorite artist from http://www.metmuseum.org/collection/the-collection-online, and a webGL/ThreeJs application that dynamically makes your own art gallery.

![Alt text](https://cloud.githubusercontent.com/assets/5739127/12076105/bf8f3b08-b16b-11e5-9cd9-f7951574b60a.png "Gallery Image")


#Current Release
##v0.1-alpha.2

The following has been implemented:

1. Menu for pause screen and rendering pause

2. Ray Cast selection of individual paintings

3. Player object collision against walls and other objects

4. Imported 3D objects successfully loaded

#Next Release
##v0.1-alpha.3

The implementations (in order of priority) for the next release will be:

1. Sub-menu for controls and credits sections

2. Allow control re-mapping and sensitivity adjustment

3. Import "missing" 3D elements for sample scene (Molding, lights, frames)

# Structure 
App structure is as follows:

		---> gallery application menu
			---> enter scene --> painting selection ---> displays information on painting
			---> search input for different artists ---> new gallery application


