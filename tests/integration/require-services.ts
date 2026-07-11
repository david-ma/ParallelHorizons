/**
 * Integration test prerequisites — fail loudly by default.
 *
 * Set SKIP_DATABASE_TESTS=1 or SKIP_MAILCATCHER_TESTS=1 to skip suites (e.g. CI).
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const MAILCATCHER_URL = 'http://127.0.0.1:1080'

export function skipDatabaseTests(): boolean {
  return process.env.SKIP_DATABASE_TESTS === '1'
}

export function skipMailcatcherTests(): boolean {
  return process.env.SKIP_MAILCATCHER_TESTS === '1'
}

export function describeDatabase(name: string, fn: () => void): void {
  if (skipDatabaseTests()) {
    describe.skip(name, fn)
    return
  }
  describe(name, fn)
}

export function describeMailcatcher(name: string, fn: () => void): void {
  if (skipMailcatcherTests()) {
    describe.skip(name, fn)
    return
  }
  describe(name, fn)
}

async function loadDatabaseUrl(): Promise<string> {
  const configPath = path.join(projectRoot, 'drizzle.config.ts')
  const drizzleConfig = await import(configPath)
  const url = drizzleConfig.default?.dbCredentials?.url as string | undefined
  if (!url?.trim()) {
    throw new Error(
      'DATABASE_URL is not configured. Copy .env.example → .env or ensure docker-compose.yml is present.'
    )
  }
  return url
}

async function tableExists(pool: mysql.Pool, name: string): Promise<boolean> {
  const [rows] = await pool.query('SHOW TABLES LIKE ?', [name])
  return Array.isArray(rows) && rows.length > 0
}

/**
 * Connect to MariaDB and verify auth + gallery tables exist (migrations applied).
 * Throws with setup instructions — does not skip silently.
 */
export async function requireDatabaseMigrated(): Promise<{ url: string; pool: mysql.Pool }> {
  const url = await loadDatabaseUrl()
  let pool: mysql.Pool
  try {
    pool = mysql.createPool(url)
    await pool.query('SELECT 1')
  } catch (err) {
    throw new Error(
      `MariaDB is not reachable at ${url.replace(/:[^:@/]+@/, ':***@')}. ` +
        'Start the database: docker compose up -d. ' +
        'Apply migrations: bun run db:migrate. ' +
        'Set SKIP_DATABASE_TESTS=1 to skip database integration tests. ' +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const requiredTables = ['users', 'sessions', 'galleries']
  const missing: string[] = []
  for (const table of requiredTables) {
    if (!(await tableExists(pool, table))) missing.push(table)
  }
  if (missing.length > 0) {
    await pool.end()
    throw new Error(
      `Database schema is incomplete (missing: ${missing.join(', ')}). ` +
        'Generate migrations after schema changes: bun run db:generate -- --name=<label>. ' +
        'Apply migrations: bun run db:migrate. ' +
        'Set SKIP_DATABASE_TESTS=1 to skip database integration tests.'
    )
  }

  return { url, pool }
}

/**
 * Verify MailCatcher web UI is reachable. Throws if not running.
 */
export async function requireMailcatcher(): Promise<void> {
  try {
    const res = await fetch(`${MAILCATCHER_URL}/messages`)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch (err) {
    throw new Error(
      `MailCatcher is not running at ${MAILCATCHER_URL}. ` +
        'Start it: mailcatcher (SMTP :1025, web UI :1080). ' +
        'Set SKIP_MAILCATCHER_TESTS=1 to skip MailCatcher integration tests. ' +
        `Original error: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

export { MAILCATCHER_URL }
