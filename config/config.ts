/**
 * Thalia config for gallery project.
 * Phase 1: homepage at /, 3D viewer at /view, static assets from public/ at root.
 */
import fs from 'fs'
import path from 'path'
import type { RawWebsiteConfig } from 'thalia/types'
import type { ServerResponse, IncomingMessage } from 'http'
import type { Website } from 'thalia/website'
import type { RequestInfo } from 'thalia/server'

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

function isValidFloorplanPayload(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== 'object') return false
  const blob = data as Record<string, unknown>
  return Array.isArray(blob.activeCells) && blob.placements != null && typeof blob.placements === 'object'
}

export const config: RawWebsiteConfig = {
  domains: ['localhost', '127.0.0.1'],

  controllers: {
    '': page('index'),
    create: page('gallery_creation'),
    'save-floorplan': async (res, req, website, requestInfo) => {
      if (requestInfo.action && requestInfo.action !== '') {
        res.statusCode = 404
        res.end('Not found')
        return
      }
      if (req.method !== 'POST') {
        res.statusCode = 405
        res.setHeader('Allow', 'POST')
        res.end('Method not allowed')
        return
      }
      try {
        const body = await readRequestBody(req)
        const parsed = JSON.parse(body) as unknown
        if (!isValidFloorplanPayload(parsed)) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: 'Invalid floorplan JSON' }))
          return
        }
        const outPath = path.join(website.rootPath, 'public', 'gallery-floorplan.json')
        fs.writeFileSync(outPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8')
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Save failed' }))
      }
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
    view: (res, req, website, requestInfo) => {
      if (requestInfo.action && requestInfo.action !== '') {
        res.statusCode = 404
        res.end('Not found')
        return
      }
      page('gallery')(res, req, website, requestInfo)
    },
  },
}
