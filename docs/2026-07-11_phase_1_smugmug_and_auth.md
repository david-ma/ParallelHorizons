# Phase 1 — Self-service galleries, SmugMug, and auth

**Date:** 2026-07-11 (updated)  
**Status:** Planning → **ready to build (Plan D chosen)**  
**Repo:** [owlsketch/gallery](https://github.com/owlsketch/gallery) (public — treat secrets accordingly)

---

## Decision (2026-07-11)

**Proceed with Plan D — Staged Creator MVP.**

Ship auth + DB-backed galleries + local-disk photo uploads first (no SmugMug blocker), then add SmugMug/UploadThing and full library UX in later slices. Performance work on the 3D engine is sufficient for Met on Safari; product gap is **identity, persistence, and a creator path**.

| Slice | Outcome | Target |
|-------|---------|--------|
| **D1** | Auth, DB, dashboard, save/publish floorplan | Creators can sign up and share `/view/:slug` |
| **D2** | Local-disk uploads + photo grid in editor | Real photos, no mock catalog |
| **D3** | SmugMug + UploadThing | Production-grade image hosting |
| **D4** | Folder library, bulk organise | Full curator UX |

---

## Goal

Let people **self-service create 3D walkthrough galleries**:

1. **Sign up / log in** (Thalia security)
2. **Upload and organise photos** (SmugMug for durable image hosting; our DB as source of truth for structure and labels)
3. **Curate** — folders, bulk select, drag-and-drop, metadata (title, artist, year, tags)
4. **Lay out** — extend today’s `/create` floorplan editor; placements reference our photo records, not hardcoded `/img/Artworks/*.jpg`
5. **Publish** — share link (`/view/:slug`) for visitors; owner edits at `/dashboard` → `/create/:id`

Today’s viewer (`/view`), editor (`/create`), floorplan JSON schema, physics, spotlights, and procedural materials are the **3D engine** (cross-browser perf validated — see [2026-07-11_optimisations.md](./2026-07-11_optimisations.md)). Phase 1 adds **identity, persistence, and a photo library** around that engine.

---

## User workflow (target)

### Visitor (no account)

1. Land on **`/`** — see product pitch + **public galleries** (published slugs from manifest/DB).
2. Click **Enter gallery** → **`/view/:slug`** — walkthrough (pointer lock, same as today).
3. Optional footer CTA: **Create your own** → `/newUser` or `/logon`.

### Creator — first visit (onboarding)

```text
/newUser  →  account created (role: user)
    ↓
/dashboard  →  empty state: “Create your first gallery”
    ↓
/create/:id  →  floorplan editor (new row in DB)
    ↓
[Upload photos]  →  /library or inline sidebar (D2+)
    ↓
Place on walls, set spawn, wall style, labels
    ↓
Save  →  POST floorplan to DB (owner-scoped)
    ↓
Publish toggle  →  isPublished=true
    ↓
Copy share link  →  /view/:slug
```

### Creator — return visit

1. **`/logon`** (or session cookie → straight to dashboard).
2. **`/dashboard`** — cards: title, updated, published/draft, **Edit** / **View** / **Copy link**.
3. **`/library`** (D2+) — upload and organise photos; drag into **`/create/:id`** sidebar.
4. **`/profile`** — name, email (Thalia profile); optional avatar URL later.

### Password reset (Thalia built-in)

1. **`/forgotPassword`** — enter email → Thalia sends mail via configured transport.
2. User opens link from email → **`/resetPassword?token=…`** → set new password.
3. **`/logon`** with new password.

**Dev:** [MailCatcher](https://mailcatcher.me/) on `127.0.0.1:1025` (SMTP) / `:1080` (web UI). **`config/mailAuth.js`** is safe to commit (no secrets) — copy from `example-auth`.

**Prod:** gitignored `mailAuth.prod.js` or env-based SMTP; never commit credentials.

### First deploy (empty DB)

1. Operator opens **`/setup`** once → creates first **`admin`**.
2. Further accounts via **`/newUser`** (unless `disableSelfRegistration: true`).

---

## Information architecture (pages)

| Path | Audience | Purpose |
|------|----------|---------|
| **`/`** | Guest + SEO | Marketing hero, featured public galleries, **Sign up** / **Log in** |
| **`/view/:slug`** | Guest | 3D walkthrough; only if `isPublished` (or owner preview) |
| **`/logon`**, **`/logout`** | All | Thalia auth |
| **`/newUser`**, **`/createNewUser`** | Guest | Self-registration |
| **`/setup`** | Guest (once) | Bootstrap admin |
| **`/forgotPassword`**, **`/resetPassword`** | Guest | Password reset flow |
| **`/dashboard`** | User | My galleries — list, create, publish, links |
| **`/library`** | User | Photo grid + upload (D2 local disk; D4 folders) |
| **`/create/:id`** | User | Floorplan editor (existing UI; load/save from DB) |
| **`/profile`**, **`/profile/:id`** | User | Account profile (Thalia `ProfileControllerFactory`) |
| **`/admin`**, **`/users`**, … | Admin | Thalia defaults when guard enabled |

**Homepage changes (D1):** replace “Editor”-only nav with **Log in / Sign up** (guest) or **Dashboard / Library** (session). Keep public gallery grid; add **“Start free”** hero CTA.

**Demo content:** keep **`parallel-horizons`**, **`met-monet`** in `public/galleries/` as read-only showcases until DB migration copies them (optional seed script).

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
| **Display** | SmugMug CDN URLs in DB (`url`, `thumbnailUrl`); 2D UI uses CDN directly; **3D viewer** uses Monetise `/mirror/` (SmugMug CDN has no CORS for WebGL) |
| **Security** | `recursiveObjectMerge(ThaliaSecurity.securityConfig(), smugmugConfig)` + explicit **`domains`** list |
| **Routes** | `/galleries`, `/album/:slug`, `/uploadPhoto`, `/create-album`, CRUD machines |

Copy or adapt: `lib-smugmug.ts`, `uploadthing.ts`, `uploadthing-cleanup.ts`, `smugmug-topup.ts`, `public/js/uploadthing-init.js`, `src/partials/image.hbs` upload UI.

**Newer option:** Thalia framework `ThaliaImageUploader` + `SmugMugAdapter` (`Thalia/server/images/image-uploader.ts`) instead of maintaining a full site-local copy of `lib-smugmug.ts`.

### Auth — `/usr/local/dev/Thalia/websites/example-auth`

Primary reference for **ThaliaSecurity + MariaDB + mail**.

| Area | Pattern |
|------|---------|
| **Enable guard** | Merge config must include `users`, `sessions`, `audits` machines → `RoleRouteGuard` auto-enabled |
| **Bootstrap** | First visit `/setup` → admin user; then `/logon` |
| **Registration** | `/newUser` + POST `/createNewUser`; disable via `disableSelfRegistration: true` |
| **Password reset** | `/forgotPassword` → email → `/resetPassword?token=` (Thalia controllers) |
| **Mail dev** | `config/mailAuth.js` → MailCatcher SMTP `127.0.0.1:1025` (committed, no secrets) |
| **Mail prod** | Separate transport file or env; not in public repo |
| **DB** | `docker-compose.yml` MariaDB + `drizzle.config.ts` + `bun drizzle-kit push` |
| **Routes** | `RoleRouteRule[]` per path; copy auth paths from example-auth; add gallery paths |
| **Profiles** | Optional `ProfileControllerFactory` (`/profile`, `/profile/:id`) |

**Config merge sketch** (same as example-auth):

```typescript
const mailAuthPath = path.join(import.meta.dirname, 'mailAuth.js')
const security = new ThaliaSecurity({ mailAuthPath })
export const config = recursiveObjectMerge(
  recursiveObjectMerge(security.securityConfig(), galleryDatabaseConfig),
  { domains: [...], routes: galleryRoutes, controllers: { ...existing } }
)
```

**Critical:** every host you use (`localhost:1337`, production domain) must appear in **`config.domains`** or the guard returns 401 for everything.

### Thalia auth integration tests + MailCatcher

From **Thalia** repo (`tests/Integration/request-handler.test.ts`):

| Env var | Default in CI | When `0` / unset |
|---------|---------------|------------------|
| **`SKIP_EXAMPLE_AUTH_TESTS`** | `1` | Run full example-auth HTTP + login matrix |
| **`SKIP_DATABASE_TESTS`** | `1` | Run `database-online.test.ts` against real MySQL |
| **`SKIP_MAILCATCHER_TESTS`** | `1` | Run forgot-password E2E (polls `http://127.0.0.1:1080/messages`) |

**Local password-reset test:**

```bash
mailcatcher   # SMTP :1025, web UI :1080
cd /path/to/Thalia/websites/example-auth && docker compose up -d && bun drizzle-kit push
# seed users if needed — see example-auth README
SKIP_MAILCATCHER_TESTS=0 SKIP_EXAMPLE_AUTH_TESTS=0 bun test tests/Integration/request-handler.test.ts
```

Gallery should **mirror this pattern** in its own `tests/integration/` — gated, never required in GitHub Actions.

### UploadThing → SmugMug skill

`/Users/david/.cursor/skills/uploadthing-smugmug/SKILL.md` — end-to-end upload pipeline notes for the SmugMug site.

### Monetise — `/usr/local/dev/monetise`

Thalia project layout (drizzle, tests, pm2). Also hosts **`GET /mirror/https://…`** — streams an upstream URL unchanged with permissive CORS for WebGL textures.

Gallery sets **`MONETISE_MIRROR_ORIGIN`** (e.g. `https://monetiseyourwebsite.com`); `artwork-source.ts` rewrites floorplan artwork URLs to `{origin}/mirror/{smugmugCdnUrl}`. See `docs/2026-07-11_diary.md` (2026-07-12 section).

Production mirror verified 2026-07-12. Local dev: run Monetise and point gallery `.env` at that origin.

---

## Plan comparison

Four ways to ship “people can use it”. Evaluated 2026-07-11.

### Plan A — Big bang (original Phase 1a→1d)

Auth + SmugMug + UploadThing + folder library + DB galleries in one push.

| Pros | Cons |
|------|------|
| Complete vision | SmugMug credentials block local dev |
| One architecture | Long time to first user |
| | Hard to test in CI |

### Plan B — Auth + DB only

Login, dashboard, save floorplan to DB; keep mock/static photos.

| Pros | Cons |
|------|------|
| Fast auth validation | Creators still stuck with demo images |
| Low risk | Weak “self-service” story |

### Plan C — SmugMug-first

Skip local uploads; require SmugMug before any creator launch.

| Pros | Cons |
|------|------|
| Production URLs day one | Secrets + OAuth friction for every contributor |
| CDN from start | Blocks contributors without SmugMug account |

### Plan D — Staged Creator MVP ✅ **chosen**

| Stage | Scope |
|-------|--------|
| **D1** | ThaliaSecurity, MariaDB, `galleries` table, dashboard, protect `/create`, publish `/view/:slug` |
| **D2** | `ThaliaImageUploader` **`local-disk`** adapter (`data/uploads/`), photo grid, wire `/create` sidebar |
| **D3** | Swap adapter to SmugMug + UploadThing (`secrets.js`) |
| **D4** | Folder tree, bulk curator (original library UX) |

| Pros | Cons |
|------|------|
| **Ship D1 quickly** — real accounts + share links | Two upload implementations (disk → SmugMug) |
| Local dev **without secrets** (D2) | Must migrate URLs when moving to CDN |
| Same `photos` table throughout | |
| Matches **example-auth** (`THALIA_IMAGE_ADAPTER=local-disk`) | |
| CI stays **unit-only**; integration gated | |

**Why not A:** D1+D2 delivers a demoable product; SmugMug is an adapter swap, not a rewrite.

**Why not B:** Photos are core to “gallery creator” — D2 is only one slice after auth.

**Why not C:** Public repo + volunteer devs need a path without SmugMug keys.

---

## Current gallery state (2026-07-11)

| Piece | Status |
|-------|--------|
| `/view` 3D viewer | Multi-slug manifest, perf tooling, Safari tier — **engine ready** |
| `/create` editor | Full editor; save writes **`public/gallery-floorplan.json`** (dev only) |
| Homepage | Product narrative; **no auth CTAs yet** |
| Auth | **None** — all routes public |
| Photo source | Mock `photoCatalog` + static `/img/Artworks/` |
| Persistence | JSON files under `public/galleries/` |
| Tests | **69 unit tests** (`bun test`); CI typecheck + unit only |
| `config/secrets.js.example` | Shape for SmugMug + UploadThing (not wired) |

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

## Implementation phases (Plan D)

### D1 — Auth + gallery persistence (build first)

- [ ] `docker-compose.yml` + `.env.example` + `drizzle.config.ts` (from example-auth)
- [ ] `models/drizzle-schema.ts` — users/sessions/audits (Thalia) + **`galleries`**
- [ ] `config/mailAuth.js` (MailCatcher) + merge **`ThaliaSecurity`** in `config/config.ts`
- [ ] Route rules: public `/`, `/view/:slug` (published only); protect `/create`, `/dashboard`, `/save-floorplan`
- [ ] **`/dashboard`** — list/create galleries; publish toggle; copy share link
- [ ] **`/view/:slug`** — load floorplan from DB when published (fallback: manifest JSON for demos)
- [ ] Homepage: **Sign up / Log in**; hero CTA **Create your gallery**
- [ ] Replace **`save-floorplan`** disk write with **owner-scoped DB update**
- [ ] `scripts/seed-test-users.ts` (copy example-auth pattern)

**Exit:** signed-up user creates a gallery, publishes, shares `/view/:slug`. Guest can still browse demo galleries.

**Manual test:** `/setup` → `/newUser` → create gallery → publish → open share link in incognito.

### D2 — Local-disk photos

- [x] `photos` table (`url`, `thumbnailUrl`, `ownerUserId`, labels)
- [x] Local-disk upload (`POST /uploadPhoto` → `public/uploads/`)
- [x] **`/library`** — upload + grid + soft delete
- [x] Wire **`/create/:id`** sidebar to owner’s photos API + inline upload
- [x] Floorplan `photoCatalog` uses DB photo ids + `/uploads/…` URLs
- [x] Soft delete strips photo id from all owner `galleries.floorplan_json`

**Exit:** creator uploads JPGs, places on walls, publishes — no SmugMug.

**You run:** after pulling, `bun run db:generate -- --name=photos` then `bun run db:migrate`.

### D3 — SmugMug + UploadThing

- [x] `load-secrets.ts` — **`.env` first**, `config/secrets.js` fallback
- [x] UploadThing router + `/api/uploadthing` (guest read/create for UT callbacks)
- [x] `POST /uploadPhoto` JSON (UT URL → SmugMug) + multipart fallback
- [x] `photos.smugmug_*` + `adapter_name` columns
- [x] Browser: `uploadthing-init.js` + shared `photo-upload-client.ts`
- [x] UploadThing temp cleanup (`data/uploadthing-temp.json`)
- [x] SmugMug CDN URL resolution (`smugmug-urls.ts`); UT client `ufsUrl` fix
- [x] 3D viewer artwork via Monetise `/mirror/` (`MONETISE_MIRROR_ORIGIN`, `artwork-source.ts`)
- [ ] Existing local `/uploads/` rows unchanged until re-upload (by design)

**Exit:** new uploads land on SmugMug (BINGO album); local-disk when `THALIA_IMAGE_ADAPTER=local-disk` or no creds.

**You run:** `bun run db:generate -- --name=photos_smugmug` then `bun run db:migrate` (if not already applied).

### D4 — Library UX (folders + bulk)

- [ ] `photo_folders` tree CRUD
- [ ] Bulk select, move, label edit
- [ ] Search / unplaced filter

**Exit:** full curator workflow from original spec.

### Hygiene (parallel)

- [x] Legacy demos removed; homepage refresh; unit tests; perf tooling
- [ ] `.env.example` committed; README link to this doc
- [ ] Update `AGENTS.md` when D1 lands

### Phase 2 (later)

- Per-wall textures, telemetry POST route, mobile controls, AI labelling

### Future layout UX (documented — not scheduled)

See [2026-07-11_user_experience.md](./2026-07-11_user_experience.md):

- Share / duplicate gallery **layouts** (not photos)
- **Rotate** room grid; **drag room cells** on the 2D plan
- Optional co-edit / remix published layouts

---

## Legacy phase labels (superseded by Plan D)

<details>
<summary>Original Phase 0–1d checklist (reference)</summary>

### Phase 0 — Hygiene

- [x] Legacy demo HTML removed
- [x] Homepage refresh, unit tests, perf

### Phase 1a — Auth + DB skeleton → **=D1**

### Phase 1b — SmugMug + UploadThing → **=D3**

### Phase 1c — Photo library UX → **=D4**

### Phase 1d — Gallery persistence → **=D1**

</details>

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

### CI

Runs **`bun run test:unit`** only — no MariaDB or MailCatcher on GitHub runners.

See **[docs/testing.md](./testing.md)** for the full matrix (integration tests fail loudly unless `SKIP_*=1`).

### Local integration (runs by default)

| Step | Command |
|------|---------|
| MariaDB | `docker compose up -d` |
| Migrations | `bun run db:migrate` |
| Seed users | `bun run db:seed` |
| MailCatcher | `mailcatcher` |
| Full suite | `bun test` |

Skip: `SKIP_DATABASE_TESTS=1`, `SKIP_MAILCATCHER_TESTS=1`.

### Layers

| Layer | What |
|-------|------|
| Unit | Floorplan, materials, spotlight, perf, quality — **already 69 tests** |
| Integration | Logon cookie, save floorplan 401/403, publish guest read, forgot-password + MailCatcher |
| Manual | Full creator journey D1→D2; `/view/:slug` incognito |

---

## Related docs

- [testing.md](./testing.md) — unit vs integration, skip flags, migrate workflow  
- [floorplan-schema.md](./floorplan-schema.md) — viewer ↔ editor JSON contract  
- [2026-07-11_optimisations.md](./2026-07-11_optimisations.md) — viewer perf, cross-browser validation  
- [2026-07-11_diary.md](./2026-07-11_diary.md) — viewer/editor history, performance notes  
- [legacy/ARCHIVE.md](./legacy/ARCHIVE.md) — removed pre-Thalia assets  
- Thalia: `websites/smugmug/docs/service-to-service.md` — calling upload from another site via `X-Host`

---

## Immediate next step

**Start D1:** copy `example-auth` docker-compose + drizzle schema stub + `ThaliaSecurity` merge into gallery `config/config.ts`. Smallest vertical slice: **logged-in user saves a floorplan to DB and publishes `/view/:slug`**.

Suggested first PR:

1. Infrastructure (compose, drizzle, mailAuth.js, security merge, routes)
2. `galleries` table + dashboard HBS
3. Redirect `/create` → `/create/:id` with auth
4. Homepage auth CTAs

Do **not** block D1 on SmugMug or library UI.
