/**
 * Thalia config — gallery viewer + D1 auth and DB-backed galleries.
 */
import path from 'path'
import type { ServerResponse, IncomingMessage } from 'http'
import type { RawWebsiteConfig } from 'thalia/types'
import type { Website } from 'thalia/website'
import type { RequestInfo } from 'thalia/server'
import { recursiveObjectMerge } from 'thalia/website'
import { ThaliaSecurity, ProfileControllerFactory, validateProfilePhotoHttpHttpsUrl, type RoleRouteRule } from 'thalia/security'
import { isValidFloorplan } from '../src/js/floorplan.js'
import { galleries as galleriesTable, photos as photosTable } from '../models/gallery-schema.js'
import { handleUploadPhoto } from './photo-upload.js'
import { listPhotosForOwner, softDeletePhoto } from './photo-store.js'
import { galleryRoutes } from './gallery-routes.js'
import {
  defaultGallerySlug,
  galleryFloorplanExists,
  loadGalleryManifest,
  resolveGallery,
  type GalleryEntry,
} from './galleries.js'
import {
  canViewDbGallery,
  createGallery,
  getGalleryById,
  getGalleryBySlug,
  listGalleriesForOwner,
  listPublishedDbGalleries,
  parseFloorplanJson,
  saveFloorplanJson,
  setGalleryPublished,
} from './gallery-store.js'

/** Render a full standalone page from a Handlebars template (no Thalia wrapper). */
function page(
  templateName: string,
  data: Record<string, unknown> = {}
): (res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo) => void {
  return (res, _req, website) => {
    const html = website.handlebars?.partials?.[templateName]
    if (!html) {
      res.statusCode = 404
      res.end('Template not found: ' + templateName)
      return
    }
    const template = website.handlebars.compile(html)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(template(data))
  }
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseActionId(action: string | undefined): number | null {
  if (!action?.trim()) return null
  const id = Number.parseInt(action.trim().split('/')[0] ?? '', 10)
  return Number.isFinite(id) ? id : null
}

function requireUserId(requestInfo: RequestInfo): number | null {
  const auth = requestInfo.userAuth
  if (!auth?.userId || auth.role === 'guest') return null
  return auth.userId
}

function redirect(res: ServerResponse, location: string, status = 303): void {
  res.statusCode = status
  res.setHeader('Location', location)
  res.end()
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function isValidFloorplanPayload(data: unknown): data is Record<string, unknown> {
  return isValidFloorplan(data)
}

function authNavData(requestInfo: RequestInfo): Record<string, unknown> {
  const auth = requestInfo.userAuth
  const loggedIn = Boolean(auth?.userId && auth.role !== 'guest')
  return {
    loggedIn,
    userName: auth?.name ?? '',
    userRole: auth?.role ?? 'guest',
  }
}

async function loadHomepageGalleries(website: Website): Promise<GalleryEntry[]> {
  const staticGalleries = loadGalleryManifest(website.rootPath)
  const staticSlugs = new Set(staticGalleries.map((g) => g.slug))
  const dbGalleries = await listPublishedDbGalleries(website)
  const merged = [...staticGalleries]
  for (const row of dbGalleries) {
    if (!staticSlugs.has(row.slug)) merged.push(row)
  }
  return merged
}

function viewPageData(website: Website, entry: GalleryEntry): Record<string, unknown> {
  return {
    production: process.env.NODE_ENV === 'production',
    floorplanUrl: entry.floorplanPath,
    galleryTitle: entry.title,
    gallerySlug: entry.slug,
    version: website.version,
  }
}

function dbEntryFromRow(row: NonNullable<Awaited<ReturnType<typeof getGalleryBySlug>>>): GalleryEntry {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description?.trim() || 'A virtual 3D gallery.',
    floorplanPath: `/api/floorplan/${row.slug}`,
  }
}

async function resolveViewEntry(
  website: Website,
  slug: string,
  viewerUserId: number | undefined
): Promise<{ entry: GalleryEntry; dbRow?: Awaited<ReturnType<typeof getGalleryBySlug>> } | null> {
  const staticEntry = resolveGallery(website.rootPath, slug)
  if (staticEntry && galleryFloorplanExists(website.rootPath, staticEntry)) {
    return { entry: staticEntry }
  }
  const dbRow = await getGalleryBySlug(website, slug)
  if (!dbRow || !canViewDbGallery(dbRow, viewerUserId)) return null
  if (!parseFloorplanJson(dbRow)) return null
  return { entry: dbEntryFromRow(dbRow), dbRow }
}

function renderView(res: ServerResponse, req: IncomingMessage, website: Website, requestInfo: RequestInfo): void {
  void (async () => {
    const slug = requestInfo.action?.trim() || defaultGallerySlug(loadGalleryManifest(website.rootPath))
    if (!slug) {
      res.statusCode = 404
      res.end('Gallery not found')
      return
    }
    const resolved = await resolveViewEntry(website, slug, requestInfo.userAuth?.userId)
    if (!resolved) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('Gallery not found')
      return
    }
    page('gallery', viewPageData(website, resolved.entry))(res, req, website, requestInfo)
  })()
}

const mailAuthPath = path.join(import.meta.dirname, 'mailAuth.js')
const security = new ThaliaSecurity({ mailAuthPath })

const profileMachine = new ProfileControllerFactory({
  buildPageDescription: (displayName) => `Account profile for ${displayName} on Parallel Horizons.`,
  profileEmailVisibility: 'owner_or_admin_only',
  validatePhoto: validateProfilePhotoHttpHttpsUrl,
})

const galleryDatabaseConfig = {
  database: {
    schemas: {
      galleries: galleriesTable,
      photos: photosTable,
    },
  },
}

const galleryControllers: RawWebsiteConfig['controllers'] = {
  '': (res, req, website, requestInfo) => {
    void (async () => {
      const galleries = await loadHomepageGalleries(website)
      page('index', {
        galleries,
        version: website.version,
        ...authNavData(requestInfo),
      })(res, req, website, requestInfo)
    })()
  },

  library: (res, req, website, requestInfo) => {
    void (async () => {
      const userId = requireUserId(requestInfo)
      if (!userId) {
        redirect(res, '/logon?next=/library')
        return
      }
      page('library', authNavData(requestInfo))(res, req, website, requestInfo)
    })()
  },

  uploadPhoto: async (res, req, website, requestInfo) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end('Method not allowed')
      return
    }
    const userId = requireUserId(requestInfo)
    if (!userId) {
      json(res, 401, { ok: false, error: 'Sign in to upload' })
      return
    }
    await handleUploadPhoto(res, req, website, userId)
  },

  'photo-delete': async (res, req, website, requestInfo) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end('Method not allowed')
      return
    }
    const userId = requireUserId(requestInfo)
    if (!userId) {
      json(res, 401, { ok: false, error: 'Sign in to delete' })
      return
    }
    const id = parseActionId(requestInfo.action)
    if (!id) {
      json(res, 400, { ok: false, error: 'Missing photo id' })
      return
    }
    const ok = await softDeletePhoto(website, id, userId)
    if (!ok) {
      json(res, 404, { ok: false, error: 'Photo not found' })
      return
    }
    json(res, 200, { ok: true })
  },

  dashboard: (res, req, website, requestInfo) => {
    void (async () => {
      const userId = requireUserId(requestInfo)
      if (!userId) {
        redirect(res, '/logon?next=/dashboard')
        return
      }
      const rows = await listGalleriesForOwner(website, userId)
      page('dashboard', {
        galleries: rows.map((row) => ({
          id: row.id,
          slug: row.slug,
          title: row.title,
          isPublished: row.isPublished,
          hasFloorplan: Boolean(row.floorplanJson?.trim()),
          editUrl: `/create/${row.id}`,
          viewUrl: `/view/${row.slug}`,
          shareUrl: `/view/${row.slug}`,
        })),
        ...authNavData(requestInfo),
      })(res, req, website, requestInfo)
    })()
  },

  'gallery-create': async (res, req, website, requestInfo) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end('Method not allowed')
      return
    }
    const userId = requireUserId(requestInfo)
    if (!userId) {
      redirect(res, '/logon?next=/dashboard')
      return
    }
    const row = await createGallery(website, userId)
    if (!row) {
      res.statusCode = 503
      res.end('Database unavailable — is MariaDB running?')
      return
    }
    redirect(res, `/create/${row.id}`)
  },

  'gallery-publish': async (res, req, website, requestInfo) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end('Method not allowed')
      return
    }
    const userId = requireUserId(requestInfo)
    if (!userId) {
      redirect(res, '/logon?next=/dashboard')
      return
    }
    const id = parseActionId(requestInfo.action)
    if (!id) {
      res.statusCode = 400
      res.end('Missing gallery id')
      return
    }
    const body = await readRequestBody(req)
    const params = new URLSearchParams(body)
    const published = params.get('published') === '1'
    const ok = await setGalleryPublished(website, id, userId, published)
    if (!ok) {
      res.statusCode = 404
      res.end('Gallery not found')
      return
    }
    redirect(res, '/dashboard')
  },

  create: (res, req, website, requestInfo) => {
    void (async () => {
      const userId = requireUserId(requestInfo)
      if (!userId) {
        redirect(res, '/logon?next=/create')
        return
      }
      const id = parseActionId(requestInfo.action)
      if (!id) {
        redirect(res, '/dashboard')
        return
      }
      const row = await getGalleryById(website, id)
      if (!row || row.ownerUserId !== userId) {
        res.statusCode = 404
        res.end('Gallery not found')
        return
      }
      page('gallery_creation', {
        galleryId: row.id,
        gallerySlug: row.slug,
        galleryTitle: row.title,
        isPublished: row.isPublished,
        ...authNavData(requestInfo),
      })(res, req, website, requestInfo)
    })()
  },

  'save-floorplan': async (res, req, website, requestInfo) => {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Allow', 'POST')
      res.end('Method not allowed')
      return
    }
    const userId = requireUserId(requestInfo)
    if (!userId) {
      json(res, 401, { ok: false, error: 'Sign in to save' })
      return
    }
    const id = parseActionId(requestInfo.action)
    if (!id) {
      json(res, 400, { ok: false, error: 'Missing gallery id' })
      return
    }
    try {
      const body = await readRequestBody(req)
      const parsed = JSON.parse(body) as unknown
      if (!isValidFloorplanPayload(parsed)) {
        json(res, 400, { ok: false, error: 'Invalid floorplan JSON' })
        return
      }
      const row = await getGalleryById(website, id)
      if (!row || row.ownerUserId !== userId) {
        json(res, 404, { ok: false, error: 'Gallery not found' })
        return
      }
      const ok = await saveFloorplanJson(website, id, userId, parsed)
      if (!ok) {
        json(res, 500, { ok: false, error: 'Save failed' })
        return
      }
      json(res, 200, { ok: true, slug: row.slug, id: row.id })
    } catch (err) {
      json(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : 'Save failed',
      })
    }
  },

  api: {
    photos: (res, req, website, requestInfo) => {
      void (async () => {
        const userId = requireUserId(requestInfo)
        if (!userId) {
          json(res, 401, { ok: false, error: 'Sign in required' })
          return
        }
        const photos = await listPhotosForOwner(website, userId)
        json(res, 200, { ok: true, photos })
      })()
    },

    floorplan: (res, req, website, requestInfo) => {
      void (async () => {
        const slug = requestInfo.slug?.trim() || requestInfo.action?.trim()
        if (!slug || slug === 'floorplan') {
          json(res, 400, { ok: false, error: 'Missing slug' })
          return
        }
        const staticEntry = resolveGallery(website.rootPath, slug)
        if (staticEntry && galleryFloorplanExists(website.rootPath, staticEntry)) {
          const fs = await import('fs')
          const filePath = path.join(website.rootPath, 'public', staticEntry.floorplanPath.replace(/^\//, ''))
          try {
            const raw = fs.readFileSync(filePath, 'utf8')
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(raw)
            return
          } catch {
            json(res, 404, { ok: false, error: 'Floorplan not found' })
            return
          }
        }
        const dbRow = await getGalleryBySlug(website, slug)
        if (!dbRow || !canViewDbGallery(dbRow, requestInfo.userAuth?.userId)) {
          json(res, 404, { ok: false, error: 'Floorplan not found' })
          return
        }
        const floorplan = parseFloorplanJson(dbRow)
        if (!floorplan) {
          json(res, 404, { ok: false, error: 'Floorplan not found' })
          return
        }
        json(res, 200, floorplan)
      })()
    },
  },

  'dev-spotlight-slider': (res, _req, website, requestInfo) => {
    if (requestInfo.action && requestInfo.action !== '') {
      res.statusCode = 404
      res.end('Not found')
      return
    }
    const html = website.handlebars?.partials?.spotlight_sidebar
    if (!html) {
      res.statusCode = 404
      res.end('Partial not found: spotlight_sidebar')
      return
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(html)
  },

  view: renderView,
}

const roleBasedConfig = recursiveObjectMerge(
  recursiveObjectMerge(security.securityConfig(), galleryDatabaseConfig),
  {
    domains: ['localhost', '127.0.0.1'],
    routes: galleryRoutes as RoleRouteRule[],
    controllers: {
      ...galleryControllers,
      profile: profileMachine.controller,
    },
  }
)

export const config: RawWebsiteConfig = roleBasedConfig
