/**
 * Gallery auth + DB integration tests.
 *
 * **Runs by default** with `bun test`. Fails loudly if MariaDB is down or migrations
 * are not applied. Opt out: SKIP_DATABASE_TESTS=1
 *
 * Prerequisites (you run these):
 *   docker compose up -d
 *   bun run db:migrate
 *   bun run db:seed
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import path from 'node:path'
import {
  fetchFromServer,
  startTestServer,
  stopTestServer,
  waitForServerHttp,
} from 'thalia/testing'
import { describeDatabase, requireDatabaseMigrated } from './require-services.js'

const PROJECT = 'gallery'
const USER_EMAIL = 'user@gallery.test'
const ADMIN_EMAIL = 'admin@gallery.test'
const PASSWORD = 'test-password'

const galleryRoot = path.resolve(import.meta.dir, '../..')
const seedScriptPath = path.join(galleryRoot, 'scripts', 'seed-test-users.ts')

function runSeedScript(): void {
  const result = Bun.spawnSync(['bun', seedScriptPath], {
    cwd: galleryRoot,
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env as Record<string, string>,
  })
  if (result.exitCode !== 0) {
    throw new Error(
      `Seed script failed (exit ${result.exitCode}): ${seedScriptPath}\n` +
        `stderr:\n${result.stderr.toString()}\nstdout:\n${result.stdout.toString()}`
    )
  }
}

function sessionCookieFromLoginResponse(response: Response): string | null {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const lines =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : (() => {
          const raw = headers.get('set-cookie')
          return raw ? [raw] : []
        })()
  const blob = lines.join('\n')
  const match = blob.match(/sessionId=([^;\s,]+)/)
  return match ? `sessionId=${match[1]}` : null
}

async function login(port: number, email: string, password: string): Promise<string | null> {
  const body = new URLSearchParams({ Email: email, Password: password }).toString()
  const response = await fetchFromServer('/logon', port, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    redirect: 'manual',
  })
  if (response.status !== 302 && response.status !== 303) return null
  return sessionCookieFromLoginResponse(response)
}

describeDatabase('Integration: database + auth (gallery)', () => {
  let port!: number
  let pool!: Awaited<ReturnType<typeof requireDatabaseMigrated>>['pool']
  let userCookie!: string

  beforeAll(async () => {
    const db = await requireDatabaseMigrated()
    pool = db.pool

    const { port: p } = await startTestServer(PROJECT, { fresh: true, rootPath: galleryRoot })
    port = p
    await waitForServerHttp(port, '/logon')

    let cookie = await login(port, USER_EMAIL, PASSWORD)
    if (!cookie) {
      runSeedScript()
      cookie = await login(port, USER_EMAIL, PASSWORD)
    }
    if (!cookie) {
      throw new Error(
        `Login failed for ${USER_EMAIL} after seed. ` +
          'Check migrations (bun run db:migrate) and DATABASE_URL matches docker-compose.'
      )
    }
    userCookie = cookie
  })

  afterAll(async () => {
    await pool?.end().catch(() => {})
    await stopTestServer(PROJECT)
  })

  test('GET /logon returns login form', async () => {
    const res = await fetchFromServer('/logon', port)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/log in|password/i)
  })

  test('GET /dashboard without session is denied', async () => {
    const res = await fetchFromServer('/dashboard', port, { redirect: 'manual' })
    expect([401, 403]).toContain(res.status)
  })

  test('GET /dashboard with session returns 200', async () => {
    const res = await fetchFromServer('/dashboard', port, {
      headers: { Cookie: userCookie },
    })
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toMatch(/Your galleries|Creator dashboard/i)
  })

  test('POST /gallery-create creates gallery and redirects to editor', async () => {
    const res = await fetchFromServer('/gallery-create', port, {
      method: 'POST',
      headers: { Cookie: userCookie },
      redirect: 'manual',
    })
    expect(res.status).toBeGreaterThanOrEqual(300)
    expect(res.status).toBeLessThan(400)
    const location = res.headers.get('location') ?? ''
    expect(location).toMatch(/\/create\/\d+/)
  })

  test('POST /save-floorplan without session returns 401', async () => {
    const res = await fetchFromServer('/save-floorplan/1', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeCells: [], placements: {} }),
    })
    expect(res.status).toBe(401)
  })

  test('admin can log in', async () => {
    const adminCookie = await login(port, ADMIN_EMAIL, PASSWORD)
    expect(adminCookie).not.toBeNull()
  })
})
