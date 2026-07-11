# Floorplan JSON schema (v2)

Contract between `/create` (editor) and `/view` (3D viewer). File is typically served at `/gallery-floorplan.json` or overridden via `globalThis.GALLERY_FLOORPLAN_URL` in `gallery.hbs`.

## Version

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `version` | `2` | Recommended | Editor always emits `2`. Viewer does not reject other values yet. |

## Grid

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `grid.rows` | number | No | `5` |
| `grid.cols` | number | No | `5` |

Defines the logical floor grid. Each cell is 6 world units wide/deep in the viewer.

## Active cells

| Field | Type | Required |
|-------|------|----------|
| `activeCells` | `string[]` | **Yes** |

Each entry is `"row,col"` (0-based). Only active cells generate walls and accept artwork. Walls are placed on edges where the neighbour cell is inactive or out of bounds.

## Placements

| Field | Type | Required |
|-------|------|----------|
| `placements` | `Record<string, …>` | **Yes** |

Keys are cell keys (`"row,col"`). Values:

### Editor format (v2)

One photo id per wall; empty string means no artwork:

```json
"3,1": {
  "north": "photo-10",
  "east": "photo-7",
  "south": "",
  "west": "photo-3"
}
```

### Viewer format (superset)

The viewer accepts **either**:

- A single photo id `string` per wall
- An array of photo ids `string[]` per wall (multiple artworks spaced along the wall)

Legacy whole-cell string (photo on north wall only):

```json
"2,2": "photo-0"
```

## Photo catalog

| Field | Type | Required |
|-------|------|----------|
| `photoCatalog` | `{ id, src, title?, artist?, year? }[]` | Recommended |

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Referenced from `placements` |
| `src` | string | URL path to image (e.g. `/img/Artworks/0.jpg`) |
| `title` | string | Shown on placard below artwork |
| `artist` | string | Optional; second line on placard |
| `year` | string \| number | Optional; third line on placard |

If a placement references an unknown id, the viewer falls back to `/img/Artworks/{index % 30}.jpg`.

## Validation (viewer)

Minimum valid document:

- `activeCells` is an array
- `placements` is an object

Invalid or missing JSON → viewer shows a **minimal empty room** (floor + lighting only), not the legacy hardcoded exhibition.

## Example

See `public/gallery-floorplan.json` in the repo.

## Workflow

1. Open `/create`, activate cells, drag photos onto wall bands.
2. Export or download JSON.
3. Save as `public/gallery-floorplan.json` (or host elsewhere and set `GALLERY_FLOORPLAN_URL`).
4. Open `/view` — layout loads asynchronously with a loading overlay.

## Future (not in v2)

- Spotlight tuning overrides in JSON (viewer currently adds one default rig per artwork)
- 3D props / objects array
- Schema migration helpers for v1 → v2
