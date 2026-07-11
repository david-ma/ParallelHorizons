# User experience — photos, ownership, and library (D2+)

**Date:** 2026-07-11  
**Scope:** How creators upload and manage photos; what is in D2 vs later slices.

---

## How a user chooses and uploads photos (D2)

| Step | Where | What happens |
|------|--------|----------------|
| 1 | **`/library`** and **`/create/:id`** sidebar | Upload via file input / drag-drop on both pages |
| 2 | **`POST /uploadPhoto`** | Server stores file under `public/uploads/` (local-disk); inserts **`photos`** row |
| 3 | **`/library` grid** | Thumbnails from **`GET /api/photos`** — only **their** rows |
| 4 | **`/create/:id`** sidebar | Same API; drag photo onto wall band |
| 5 | **Save** | Floorplan JSON stores `photoCatalog[].id` = **`photos.id`** (string); `src` = `/uploads/…` |

No SmugMug or UploadThing in D2 — that is **D3** (same `photos` table, different URL source).

---

## Ownership — how we know a photo belongs to one user

Every uploaded image is a row in **`photos`**:

| Column | Purpose |
|--------|---------|
| **`owner_user_id`** | FK → `users.id` — **required** on insert |
| **`deleted_at`** | Soft delete (NULL = visible) |

**Rules:**

1. **Insert** — only when session `userAuth.userId` is set; always set `owner_user_id` from session.
2. **List** — every query includes `owner_user_id = ?` AND `deleted_at IS NULL`.
3. **Delete** — soft-delete only if `owner_user_id` matches session.
4. **API** — no listing other users’ photos; no delete by id guess (404 if not owner).

Floorplan **`photoCatalog`** on save is built from the editor’s loaded set (owner’s photos). Published galleries embed URLs + ids at save time; another user never sees your library in their dashboard.

**Later (D3):** add `smugmug_image_key` / CDN URL; ownership still via `owner_user_id`.

---

## Soft delete (“delete a photo”)

User clicks **Delete** on **`/library`** → **`POST /photo-delete/:id`**.

- Sets **`deleted_at = NOW()`** (does not remove the file from disk in D2).
- Photo **disappears** from library grid and **`/api/photos`**.
- Photo **does not appear** in editor sidebar for new placements.

**Published galleries:** on soft-delete, **remove this photo id from all floorplans owned by that user** (update `galleries.floorplan_json` in DB), then hide from library/editor. Re-publish if needed so `/view/:slug` matches.

*(Decision 2026-07-11: auto-strip from floorplans on delete.)*

**Restore / purge:** not in D2; optional admin job later.

---

## Folders

| Slice | Folders |
|-------|---------|
| **D2** | **No** — flat library list per user |
| **D4** | **`photo_folders`** tree, drag between folders, bulk actions |

Schema stub: **`photos.folder_id`** nullable (unused until D4).

---

## Future UX (not D2 — documented only)

Captured from product direction; **do not implement** until after D2/D3 unless reprioritised.

### Share gallery layouts

- Export/import floorplan JSON (already in editor).
- **Future:** “Duplicate layout” from another user’s **published** template (layout only, not their photos).
- **Future:** Share link that copies room grid + spawn, not photo catalog.

### Rotate / rearrange rooms

- **Future:** Rotate active cell grid (90° steps) with placements transforming N/E/S/W.
- **Future:** Drag entire **room cells** on the 2D plan (not just photos on walls).
- **Future:** Multi-room templates (L-shape, wing off main grid).

### Collaboration

- **Future:** Co-edit gallery (shared `gallery_members` table).
- **Future:** Public “remix this layout” from `/view/:slug`.

---

## Pages (creator)

| Path | D2 |
|------|-----|
| `/library` | Upload + grid + delete |
| `/create/:id` | Sidebar wired to `/api/photos` |
| `/dashboard` | Link to library + galleries |

---

## Related

- [2026-07-11_phase_1_smugmug_and_auth.md](./2026-07-11_phase_1_smugmug_and_auth.md) — Plan D slices  
- [testing.md](./testing.md) — DB migrate workflow  
- [floorplan-schema.md](./floorplan-schema.md) — `photoCatalog` contract  
