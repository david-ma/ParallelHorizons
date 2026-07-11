/**
 * Password-reset flow via MailCatcher.
 *
 * **Runs by default** with `bun test`. Fails loudly if MailCatcher or MariaDB is unavailable.
 * Opt out: SKIP_MAILCATCHER_TESTS=1 (database suite must still pass unless SKIP_DATABASE_TESTS=1).
 *
 * Prerequisites (you run these):
 *   docker compose up -d && bun run db:migrate
 *   mailcatcher
 */
import { afterAll, beforeAll, expect, test } from 'bun:test'
import path from 'node:path'
import {
  fetchFromServer,
  startTestServer,
  stopTestServer,
  waitForServerHttp,
} from 'thalia/testing'
import {
  describeMailcatcher,
  MAILCATCHER_URL,
  requireDatabaseMigrated,
  requireMailcatcher,
  skipDatabaseTests,
} from './require-services.js'

const PROJECT = 'gallery'
const galleryRoot = path.resolve(import.meta.dir, '../..')

describeMailcatcher('Integration: MailCatcher password reset (gallery)', () => {
  let port!: number
  let pool!: Awaited<ReturnType<typeof requireDatabaseMigrated>>['pool']

  beforeAll(async () => {
    if (skipDatabaseTests()) {
      throw new Error(
        'MailCatcher integration requires the database suite. ' +
          'Do not set SKIP_DATABASE_TESTS=1 when running MailCatcher tests.'
      )
    }
    const db = await requireDatabaseMigrated()
    pool = db.pool
    await requireMailcatcher()

    const { port: p } = await startTestServer(PROJECT, { fresh: true, rootPath: galleryRoot })
    port = p
    await waitForServerHttp(port, '/forgotPassword')
  })

  afterAll(async () => {
    await pool?.end().catch(() => {})
    await stopTestServer(PROJECT)
  })

  test('forgot password sends mail to MailCatcher', async () => {
    const TEST_EMAIL = `reset-${Date.now()}@gallery.test`
    const OLD_PASSWORD = 'old-password-1'
    const NEW_PASSWORD = 'new-password-2'

    const clearRes = await fetch(`${MAILCATCHER_URL}/messages`, { method: 'DELETE' })
    expect(clearRes.ok).toBe(true)

    const createBody = new URLSearchParams({
      Name: 'Reset User',
      Email: TEST_EMAIL,
      Password: OLD_PASSWORD,
    }).toString()
    const createResp = await fetchFromServer('/createNewUser', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createBody,
      redirect: 'manual',
    })
    expect([200, 302, 303]).toContain(createResp.status)

    const forgotBody = new URLSearchParams({ email: TEST_EMAIL }).toString()
    const forgotResp = await fetchFromServer('/forgotPassword', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: forgotBody,
    })
    expect([200, 302, 303]).toContain(forgotResp.status)

    let body: string | null = null
    for (let attempt = 0; attempt < 40; attempt++) {
      const listRes = await fetch(`${MAILCATCHER_URL}/messages`)
      expect(listRes.ok).toBe(true)
      const messages = (await listRes.json()) as Array<{ id: number }>
      const match = [...messages].reverse().find((m) => JSON.stringify(m).includes(TEST_EMAIL))
      if (match) {
        const htmlRes = await fetch(`${MAILCATCHER_URL}/messages/${match.id}.html`)
        if (htmlRes.ok) {
          body = await htmlRes.text()
          break
        }
        const plainRes = await fetch(`${MAILCATCHER_URL}/messages/${match.id}.plain`)
        if (plainRes.ok) {
          body = await plainRes.text()
          break
        }
      }
      await new Promise((r) => setTimeout(r, 150))
    }

    if (!body) {
      throw new Error(
        `No reset email in MailCatcher for ${TEST_EMAIL}. ` +
          'Ensure mailcatcher is running and config/mailAuth.js points at 127.0.0.1:1025.'
      )
    }

    expect(body).toMatch(/reset|password/i)

    const tokenMatch = body.match(/resetPassword\?token(?:=|&#x3D;)([^"'\\s<]+)/i)
    expect(tokenMatch).not.toBeNull()
    const token = decodeURIComponent(tokenMatch![1]!)

    const resetGetResp = await fetchFromServer(`/resetPassword?token=${encodeURIComponent(token)}`, port)
    expect(resetGetResp.status).toBe(200)

    const resetBody = new URLSearchParams({
      token,
      password: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    }).toString()
    const resetResp = await fetchFromServer('/resetPassword', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: resetBody,
      redirect: 'manual',
    })
    expect([302, 303]).toContain(resetResp.status)

    const loginBody = new URLSearchParams({ Email: TEST_EMAIL, Password: NEW_PASSWORD }).toString()
    const loginResp = await fetchFromServer('/logon', port, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: loginBody,
      redirect: 'manual',
    })
    expect(loginResp.status).toBeGreaterThanOrEqual(300)
    expect(loginResp.status).toBeLessThan(400)
    const cookie = loginResp.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/sessionId=/)
  })
})
