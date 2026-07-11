/**
 * GET/POST /api/uploadthing — Node req/res → Fetch for UploadThing route handler.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRouteHandler } from 'uploadthing/server'
import { uploadthingRouter } from './uploadthing.js'
import { loadUploadThingToken } from './load-secrets.js'
import { runCleanupIfNeeded } from './uploadthing-cleanup.js'

let uploadThingHandler: ((req: Request) => Promise<Response>) | null = null

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function nodeRequestToFetch(req: IncomingMessage, body: Buffer): Promise<Request> {
  const host = req.headers.host ?? 'localhost'
  const url = `http://${host}${req.url ?? '/'}`
  return new Request(url, {
    method: req.method ?? 'GET',
    headers: req.headers as HeadersInit,
    body: body.length > 0 ? body : undefined,
  })
}

async function getHandler(token: string): Promise<(req: Request) => Promise<Response>> {
  if (!uploadThingHandler) {
    uploadThingHandler = createRouteHandler({
      router: uploadthingRouter,
      config: { token },
    })
  }
  return uploadThingHandler
}

export function uploadThingRouteController(
  res: ServerResponse,
  req: IncomingMessage
): void {
  void (async () => {
    const method = (req.method ?? 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'POST') {
      res.statusCode = 405
      res.end('Method Not Allowed')
      return
    }
    const token = await loadUploadThingToken()
    if (!token) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: false, error: 'UploadThing token not configured' }))
      return
    }
    const body = await readRequestBody(req)
    const fetchReq = await nodeRequestToFetch(req, body)
    const handler = await getHandler(token)
    const response = await handler(fetchReq)
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    const ab = await response.arrayBuffer()
    res.end(Buffer.from(ab))
  })().catch((err) => {
    console.error('UploadThing route error:', err)
    if (res.headersSent) return
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'UploadThing error' }))
  })
}

export function uploadThingCleanupController(res: ServerResponse): void {
  void (async () => {
    const token = await loadUploadThingToken()
    const result = await runCleanupIfNeeded(token)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: true, ...result }))
  })().catch((err) => {
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Cleanup failed' }))
  })
}
