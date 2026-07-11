# Phase 1 — Self-service galleries, SmugMug, and auth

**Date:** 2026-08-11  
**Status:** Planning  
**Repo:** [owlsketch/gallery](https://github.com/owlsketch/gallery) (public — treat secrets accordingly)

---

## Goal

Let people **self-service create 3D walkthrough galleries**:

1. **Sign up / log in** (Thalia security)
2. **Upload and organise photos** (SmugMug for durable image hosting; our DB as source of truth for structure and labels)
3. **Curate** — folders, bulk select, drag-and-drop, metadata (title, artist, year, tags)
4. **Lay out** — extend today’s `/create` floorplan editor; placements reference our photo records, not hardcoded `/img/Artworks/*.jpg`
5. **Publish** — share link (`/view/:slug`) for visitors; owner edits at `/create/:id` or `/dashboard`

Today’s viewer (`/view`), editor (`/create`), floorplan JSON schema, physics, spotlights, and procedural materials are the **3D engine**. Phase 1 adds **identity, persistence, and a photo library** around that engine.

---

## Security and secrets (public repo)

This repository is **public**. Anything committed is visible forever (including git history).

### Do

| Practice | Why |
|----------|-----|
| **`config/secrets.js`** (gitignored) for SmugMug OAuth, UploadThing token, SMTP | Same pattern as `websites/smugmug` and `example-auth` |
| **`config/.gitignore`** listing `secrets.js`, `cred.js`, `mailAuth.js` if prod SMTP has credentials | Belt-and-braces even when root `.gitignore` covers `.env` |
| **`.env` / `.env.*` gitignored**; use `.env.example` with placeholder names only | CI and docs reference variable *names*, not values |
| **Production secrets via server env** or files outside the git clone | pm2, Ansible, or host-only paths |
| **Audit route rules** when `RoleRouteGuard` is enabled — unlisted paths are **open** | See Thalia security README |

### Do not

- Commit SmugMug consumer key/secret, OAuth token/secret, UploadThing token, DB passwords, or SMTP passwords.
- Paste live credentials into issues, diary, or this doc.
- Rely on “obscurity” in client-side JS — browser only gets public UploadThing app id if required; server holds the token.

### Docker Compose passwords — are they “OK”?

**Mostly yes for a typical server-only deployment**, with caveats:

| Scenario | Risk |
|----------|------|
| MariaDB bound to **`127.0.0.1:3377:3306`** on the host; firewall blocks 3306 from the internet | Low — passwords in `docker-compose.yml` are reachable only from the host (and containers on the Docker network). This matches `example-auth`. |
| **`ports: "3306:3306"`** on a VPS with no firewall | **High** — compose passwords can be brute-forced from the internet. |
| **Public git repo contains compose passwords** | Acceptable if DB is **not** internet-exposed; still prefer env vars (`MYSQL_PASSWORD` from `.env`) so the **same compose file** can be public while secrets stay on the server. |
| **Leaked compose password + exposed port** | Full database compromise |

**Recommendation for gallery:** copy `example-auth`’s pattern (MariaDB on localhost-mapped port, not `0.0.0.0:3306` in production), but load **`MYSQL_ROOT_PASSWORD` / `MYSQL_PASSWORD` from a gitignored `.env`** referenced by compose. Document connection via `DATABASE_URL` in `.env.example` only.

---

## Reference implementations (read before building)

### SmugMug site — `/usr/local/dev/Thalia/websites/smugmug`

Primary reference for **images + upload + cache**.

| Area | Pattern |
|------|---------|
| **Credentials** | Gitignored `config/secrets.js` → `loadSmugMugCreds()` (dynamic import) |
| **DB cache** | Thalia `albums` + `images` tables; read DB first, background `smugmug-topup.ts` sync |
| **Upload** | Browser → **UploadThing** (`/api/uploadthing`) → server fetches buffer → **`uploadToAlbum()`** → insert `images` row |
| **Cleanup** | `uploadthing-cleanup.ts` + `data/uploadthing-temp.json` |
| **Display** | SmugMug CDN URLs in DB (`url`, `thumbnailUrl`); no local image proxy |
| **Security** | `recursiveObjectMerge(ThaliaSecurity.securityConfig(), smugmugConfig)` + explicit **`domains`** list |
| **Routes** | `/galleries`, `/album/:slug`, `/uploadPhoto`, `/create-album`, CRUD machines |

Copy or adapt: `lib-smugmug.ts`, `uploadthing.ts`, `uploadthing-cleanup.ts`, `smugmug-topup.ts`, `public/js/uploadthing-init.js`, `src/partials/image.hbs` upload UI.

**Newer option:** Thalia framework `ThaliaImageUploader` + `SmugMugAdapter` (`Thalia/server/images/image-uploader.ts`) instead of maintaining a full site-local copy of `lib-smugmug.ts`.

### Auth — `/usr/local/dev/Thalia/websites/example-auth`

Primary reference for **ThaliaSecurity + MariaDB**.

| Area | Pattern |
|------|---------|
| **Enable guard** | Merge config must include `users`, `sessions`, `audits` machines → `RoleRouteGuard` auto-enabled |
| **Bootstrap** | First visit `/setup` → admin user; then `/logon` |
| **Mail** | `config/mailAuth.js` (MailCatcher in dev) |
| **DB** | `docker-compose.yml` MariaDB + `drizzle.config.ts` + `bun drizzle-kit push` |
| **Routes** | `RoleRouteRule[]` per path; copy auth paths from example-auth; add gallery paths |

### Monetise — `/usr/local/dev/monetise`

Not a SmugMug reference. Useful for **Thalia project layout** (drizzle, tests, `config/config.ts`, pm2/Docker). No image pipeline to reuse for gallery Phase 1.

### UploadThing → SmugMug skill

`/Users/david/.cursor/skills/uploadthing-smugmug/SKILL.md` — end-to-end upload pipeline notes for the SmugMug site.

---

## Current gallery state (2026-08-11)

| Piece | Status |
|-------|--------|
| `/view` 3D viewer | TS modules, Rapier, JSON floorplan, spotlights, materials, placards |
| `/create` editor | Grid, drag placements, spawn, labels, wall style, save to **`public/gallery-floorplan.json`** |
| Auth | **None** — all routes public |
| Photo source | Mock `photoCatalog` + static `/img/Artworks/` |
| Persistence | Single JSON file on disk |
| Tests | 21 unit tests (`bun test`) on floorplan/layout/materials/spotlight |

**Legacy cleanup (this pass):** removed pre-Thalia standalone HTML demos and vendored Three.js bundles under `public/js/` (see `docs/legacy/ARCHIVE.md`). Thalia serves compiled TS from `src/js/`.

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  Homepage · Dashboard · Photo library · Floorplan editor · /view │
└────────────┬───────────────────────────────┬──────────────────────┘
             │ UploadThing (temp)            │ HTTPS
             ▼                               ▼
┌────────────────────────────┐    ┌──────────────────────────────┐
│  Gallery Thalia site       │    │  SmugMug API + CDN           │
│  RoleRouteGuard            │───▶│  (durable images)            │
│  MariaDB (source of truth)   │    └──────────────────────────────┘
│  - users/sessions (Thalia) │
│  - photo_folders           │
│  - photos (→ SmugMug keys) │
│  - galleries / floorplans  │
└────────────────────────────┘
```

**Source of truth on our server:** folder tree, labels, gallery ownership, floorplan layout, which photo id sits on which wall.  
**SmugMug:** binary storage, CDN URLs, optional album-per-user or album-per-gallery strategy.

---

## Data model (proposed)

Extend Thalia security tables with gallery-specific schema (Drizzle).

### `galleries`

| Column | Notes |
|--------|-------|
| `id`, `slug`, `ownerUserId` | FK → `users.id` |
| `title`, `description` | |
| `floorplanJson` | JSON blob (v2 schema) or normalised later |
| `isPublished` | Public `/view/:slug` when true |
| `smugmugAlbumKey` | Optional dedicated SmugMug album per gallery |
| timestamps, soft delete | |

### `photo_folders`

| Column | Notes |
|--------|-------|
| `id`, `ownerUserId` | |
| `parentId` | Nullable — tree |
| `name`, `sortOrder` | |
| timestamps | |

### `photos`

| Column | Notes |
|--------|-------|
| `id`, `ownerUserId`, `folderId` | |
| `smugmugAlbumKey`, `smugmugImageKey` | Link to SmugMug |
| `thumbnailUrl`, `url` | Cached from SmugMug at upload/sync |
| `title`, `artist`, `year`, `caption` | Placard + library labels |
| `filename`, `metadataJson` | Optional EXIF / AI notes |
| timestamps | |

### Relationship to floorplan JSON

**Option A (Phase 1):** `photoCatalog` entries use `id` = our `photos.id`; `src` = cached SmugMug URL (denormalised for viewer offline resilience).

**Option B (later):** Viewer resolves `photoId` server-side or via API; floorplan stores only ids.

Reuse existing `FloorplanBlob` fields: `placements`, `activeCells`, `spawn`, `wallStyle`.

---

## Photo library UI (new — major UX piece)

Not in smugmug site as-is; smugmug has **album list + album grid**, not a general **folder tree + bulk curator**.

### Requirements

- **Tree sidebar** — folders + subfolders (create, rename, delete, move)
- **Grid / list** — thumbnails, multi-select, shift-click range
- **Drag-and-drop** — photos between folders; from upload dropzone into folder
- **Bulk actions** — move, delete, tag, edit labels
- **Search / filter** — by title, artist, unplaced, in-gallery
- **Detail panel** — title, artist, year, caption; link to SmugMug web URI optional

### Integration with `/create`

- Replace mock 12-photo sidebar with **“My photos”** scoped to owner (and folder filter)
- Drag to wall bands unchanged; `photoCatalog` built from selected library or full gallery set stored on save
- “Unplaced only” filter already exists — wire to library ids

### Tech approach

- **Phase 1a:** Server-rendered HBS + progressive enhancement (match `/create` style)
- **Phase 1b:** Optional lightweight client module (vanilla TS or small D3/list lib) for tree DnD — avoid React unless Thalia site already uses it
- **API:** JSON routes under `/api/photos`, `/api/folders` with `RoleRouteGuard` + owner checks

---

## Upload flow (reuse SmugMug site)

1. User selects files in library or editor upload zone  
2. **UploadThing** client (`uploadthing-init.js`) → temp storage  
3. **POST `/uploadPhoto`** with `{ uploadThingUrl, albumKey, fileKey, filename }`  
4. Server: fetch UT buffer → `uploadToAlbum(creds, …)` → SmugMug  
5. Insert **`photos`** row (+ optional **`images`** cache row if sharing Thalia smugmug tables)  
6. Return `{ id, thumbnailUrl, url }` to client  
7. Run **cleanup** if UT storage over threshold  

**Album strategy (decide in implementation):**

- **One SmugMug album per user** (simple); folders are ours only  
- **One album per gallery** (isolates exports; more API calls)  
- **Hybrid:** user root album + optional gallery sub-albums  

Recommendation: **one album per user** for Phase 1; store `smugmugAlbumKey` on `users` profile blob or first-upload provisioning.

---

## Auth and route plan

Merge pattern from `example-auth`:

```typescript
const security = new ThaliaSecurity({ mailAuthPath })
export const config = recursiveObjectMerge(
  recursiveObjectMerge(security.securityConfig(), galleryDatabaseConfig),
  { domains: [...], routes: galleryRoutes, controllers: { ...existing } }
)
```

### Suggested route rules

| Path | Guest | User | Admin |
|------|-------|------|-------|
| `/`, `/view`, `/view/:slug` | read | read | read |
| `/logon`, `/setup`, `/forgotPassword`, … | auth flows | auth flows | auth flows |
| `/api/uploadthing` | create | create | create |
| `/uploadPhoto` | — | create | create |
| `/dashboard`, `/library` | — | read | read |
| `/create`, `/create/:id` | — | read, create, update | full |
| `/save-floorplan` | — | create, update | full |
| `/admin`, `/users`, … | framework defaults | | |

**Public share links:** keep `guest` read on `/view/:slug` for published galleries only (controller checks `isPublished`).

**Replace** today’s `save-floorplan` writing to `public/gallery-floorplan.json` with **DB write** scoped to `ownerUserId`.

---

## Implementation phases

### Phase 0 — Hygiene (done / in progress)

- [x] Legacy demo HTML + vendored Three.js removed from `public/`
- [x] Homepage refresh (product narrative, CTAs)
- [x] Unit tests for floorplan validation
- [ ] Commit open work on `main` (pause power-save, homepage, plan)
- [ ] `config/.gitignore` + `.env.example`
- [ ] Update `AGENTS.md` changelog

### Phase 1a — Auth + DB skeleton

- [ ] `docker-compose.yml` + `drizzle.config.ts` (from example-auth)
- [ ] `models/drizzle-schema.ts` — users, sessions, audits + `galleries` stub
- [ ] Merge `ThaliaSecurity` into `config/config.ts`
- [ ] Route rules; verify **every** deployment host in `domains`
- [ ] `/setup` → admin; protect `/create`, `/save-floorplan`
- [ ] Homepage: “Log in” / “Sign up” links

**Exit:** only logged-in users can save; visitors can still `/view` demo.

### Phase 1b — SmugMug + UploadThing

- [ ] Gitignored `config/secrets.js` + `loadSmugMugCreds()`
- [ ] Copy/adapt upload router + `/uploadPhoto` + cleanup
- [ ] `photos` table + minimal **`/library`** page (grid only, one folder)
- [ ] Wire upload UI into library

**Exit:** user can upload photos; URLs stored in DB.

### Phase 1c — Photo library UX

- [ ] Folder tree CRUD + drag-drop organise
- [ ] Bulk select / move / label edit
- [ ] Connect `/create` sidebar to library API

**Exit:** curator workflow replaces mock catalog.

### Phase 1d — Gallery persistence + publish

- [ ] `galleries` CRUD; save floorplan to DB
- [ ] `/view/:slug` loads owner’s published floorplan + resolves photo URLs
- [ ] Dashboard: list galleries, edit, publish toggle, copy share link

**Exit:** end-to-end self-service MVP.

### Phase 2 (later)

- Per-wall textures (already gallery-wide in JSON)
- SmugMug sync / top-up background jobs
- Telemetry overlay (diary plan)
- Mobile controls
- Optional AI labelling (Mistral path in smugmug site)

---

## Open decisions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Share Thalia `images` table vs gallery `photos` | Shared vs separate | **Separate `photos`** + clear owner FK; optionally sync SmugMug keys into both |
| Invite-only vs self-registration | `disableSelfRegistration` | Start **open registration** on staging; invite-only for prod if spam |
| Demo gallery | Static JSON vs DB | Keep **`public/gallery-floorplan.json`** as anonymous demo until `/view/demo` route |
| UploadThing on public repo | App id public, token secret | Token only in `secrets.js` |

---

## Files to add (checklist)

```
gallery/
├── config/
│   ├── .gitignore          # secrets.js, etc.
│   ├── secrets.js.example  # shape only, no real keys
│   ├── mailAuth.js         # dev MailCatcher (safe to commit)
│   ├── lib-smugmug.ts      # or use ThaliaImageUploader
│   ├── uploadthing.ts
│   └── uploadthing-cleanup.ts
├── models/
│   ├── drizzle-schema.ts
│   └── gallery-schema.ts   # galleries, photos, photo_folders
├── drizzle/
├── docker-compose.yml
├── drizzle.config.ts
├── .env.example
├── src/
│   ├── library.hbs
│   ├── dashboard.hbs
│   └── js/library.ts
└── tests/
    └── integration/        # save-floorplan, auth smoke
```

---

## Testing strategy

| Layer | What |
|-------|------|
| Unit | Already: floorplan, materials, spotlight — extend `parseWallStyle`, slug helpers |
| Integration | Auth logon, POST `/save-floorplan` with session cookie, upload mock |
| Manual | UploadThing → SmugMug on staging creds; `/view/:slug` as guest |
| Gated | SmugMug live API tests with `SMUGMUG_RUN_INTEGRATION=1` (copy smugmug site pattern) |

---

## Related docs

- [floorplan-schema.md](./floorplan-schema.md) — viewer ↔ editor JSON contract  
- [2026-07-11_diary.md](./2026-07-11_diary.md) — viewer/editor history, performance notes  
- [legacy/ARCHIVE.md](./legacy/ARCHIVE.md) — removed pre-Thalia assets  
- Thalia: `websites/smugmug/docs/service-to-service.md` — calling upload from another site via `X-Host`

---

## Immediate next step

**Phase 1a:** add MariaDB + `ThaliaSecurity` merge and protect `/create` — smallest step that unlocks everything else without yet building the full library UI.
