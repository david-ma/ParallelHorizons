/**
 * Load secrets from process.env first, then config/secrets.js (gitignored).
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export type SmugMugCredentials = {
  consumer_key: string
  consumer_secret: string
  oauth_token: string
  oauth_token_secret: string
  /** Optional default album key (BINGO / shared gallery album). */
  album?: string
}

function smugmugFromEnv(): SmugMugCredentials | null {
  const consumer_key = process.env.SMUGMUG_CONSUMER_KEY?.trim()
  const consumer_secret = process.env.SMUGMUG_CONSUMER_SECRET?.trim()
  const oauth_token = process.env.SMUGMUG_OAUTH_TOKEN?.trim()
  const oauth_token_secret = process.env.SMUGMUG_OAUTH_TOKEN_SECRET?.trim()
  if (!consumer_key || !consumer_secret || !oauth_token || !oauth_token_secret) return null
  const album =
    process.env.BINGO_ALBUM_KEY?.trim() ||
    process.env.SMUGMUG_ALBUM_KEY?.trim() ||
    process.env.SMUGMUG_DEFAULT_ALBUM?.trim() ||
    undefined
  return { consumer_key, consumer_secret, oauth_token, oauth_token_secret, album }
}

function uploadThingFromEnv(): string | null {
  const token = process.env.UPLOADTHING_TOKEN?.trim()
  return token || null
}

function albumKeyFromEnv(): string | null {
  return (
    process.env.BINGO_ALBUM_KEY?.trim() ||
    process.env.SMUGMUG_ALBUM_KEY?.trim() ||
    process.env.SMUGMUG_DEFAULT_ALBUM?.trim() ||
    null
  )
}

async function importSecretsModule(): Promise<Record<string, unknown> | null> {
  const secretsPath = path.join(import.meta.dirname, 'secrets.js')
  if (!fs.existsSync(secretsPath)) return null
  try {
    return (await import(pathToFileURL(secretsPath).href)) as Record<string, unknown>
  } catch {
    return null
  }
}

function smugmugFromModule(m: Record<string, unknown>): SmugMugCredentials | null {
  const raw = m.smugmug ?? m.default
  if (!raw || typeof raw !== 'object') return null
  const creds = raw as Record<string, unknown>
  if (
    typeof creds.consumer_key !== 'string' ||
    typeof creds.consumer_secret !== 'string' ||
    typeof creds.oauth_token !== 'string' ||
    typeof creds.oauth_token_secret !== 'string'
  ) {
    return null
  }
  const album =
    (typeof creds.album === 'string' && creds.album.trim()) ||
    (typeof m.BINGO_ALBUM_KEY === 'string' && m.BINGO_ALBUM_KEY.trim()) ||
    undefined
  return {
    consumer_key: creds.consumer_key,
    consumer_secret: creds.consumer_secret,
    oauth_token: creds.oauth_token,
    oauth_token_secret: creds.oauth_token_secret,
    album,
  }
}

export async function loadSmugMugCreds(): Promise<SmugMugCredentials | null> {
  const fromEnv = smugmugFromEnv()
  if (fromEnv) return fromEnv
  const mod = await importSecretsModule()
  return mod ? smugmugFromModule(mod) : null
}

export async function loadUploadThingToken(): Promise<string | null> {
  const fromEnv = uploadThingFromEnv()
  if (fromEnv) return fromEnv
  const mod = await importSecretsModule()
  if (!mod) return null
  return typeof mod.UPLOADTHING_TOKEN === 'string' ? mod.UPLOADTHING_TOKEN.trim() : null
}

export async function loadDefaultAlbumKey(): Promise<string | null> {
  const fromEnv = albumKeyFromEnv()
  if (fromEnv) return fromEnv
  const creds = await loadSmugMugCreds()
  if (creds?.album?.trim()) return creds.album.trim()
  const mod = await importSecretsModule()
  if (!mod) return null
  if (typeof mod.BINGO_ALBUM_KEY === 'string' && mod.BINGO_ALBUM_KEY.trim()) {
    return mod.BINGO_ALBUM_KEY.trim()
  }
  return null
}

export type ImageAdapterName = 'local-disk' | 'smugmug'

/** Resolve storage backend. `THALIA_IMAGE_ADAPTER` overrides; else SmugMug when creds exist. */
export function resolveImageAdapter(hasSmugMugCreds: boolean): ImageAdapterName {
  const forced = process.env.THALIA_IMAGE_ADAPTER?.trim()
  if (forced === 'local-disk' || forced === 'smugmug') return forced
  return hasSmugMugCreds ? 'smugmug' : 'local-disk'
}
