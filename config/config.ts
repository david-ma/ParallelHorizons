/**
 * Thalia config for gallery project.
 * Phase 1: homepage at /, 3D viewer at /view, static assets from public/ at root.
 */
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

export const config: RawWebsiteConfig = {
  domains: ['localhost', '127.0.0.1'],

  controllers: {
    '': page('index'),
    view: (res, req, website, requestInfo) => {
      if (requestInfo.action && requestInfo.action !== '') {
        // e.g. /view/foo -> 404 or fall through
        res.statusCode = 404
        res.end('Not found')
        return
      }
      page('gallery')(res, req, website, requestInfo)
    },
  },
}
