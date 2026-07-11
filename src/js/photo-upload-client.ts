/**
 * Browser upload helper — UploadThing when available, else multipart to /uploadPhoto.
 */
export type PhotoDto = {
  id: string
  title: string
  src: string
  thumbnailUrl: string
  artist?: string
  year?: string
  filename?: string
}

type UploadThingFileResult = {
  url?: string
  ufsUrl?: string
  appUrl?: string
  key?: string
  name?: string
  size?: number
}

declare global {
  interface Window {
    uploadFilesToUploadThing?: (
      route: string,
      opts: { files: File[] }
    ) => Promise<unknown[]>
  }
}

function titleFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || file.name
}

/** UT v7 uses `ufsUrl`; older clients used `url` / `appUrl`. */
function utPublicUrl(item: UploadThingFileResult): string | undefined {
  return item.ufsUrl?.trim() || item.url?.trim() || item.appUrl?.trim() || undefined
}

function normalizeUtResult(raw: unknown): UploadThingFileResult | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const data =
    obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : obj
  const pick = (k: string): string | undefined =>
    typeof data[k] === 'string' && data[k].trim() ? data[k].trim() : undefined
  const size = typeof data.size === 'number' ? data.size : undefined
  return {
    url: pick('url'),
    ufsUrl: pick('ufsUrl'),
    appUrl: pick('appUrl'),
    key: pick('key'),
    name: pick('name'),
    size,
  }
}

async function postJsonToUploadPhoto(body: Record<string, unknown>): Promise<PhotoDto> {
  const res = await fetch('/uploadPhoto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const payload = (await res.json()) as { ok?: boolean; photo?: PhotoDto; error?: string }
  if (!res.ok || !payload.ok || !payload.photo) {
    throw new Error(payload.error || 'Upload failed')
  }
  return payload.photo
}

async function postMultipartFile(file: File): Promise<PhotoDto> {
  const form = new FormData()
  form.append('fileToUpload', file)
  form.append('title', titleFromFile(file))
  const res = await fetch('/uploadPhoto', { method: 'POST', body: form, credentials: 'same-origin' })
  const payload = (await res.json()) as { ok?: boolean; photo?: PhotoDto; error?: string }
  if (!res.ok || !payload.ok || !payload.photo) {
    throw new Error(payload.error || 'Upload failed')
  }
  return payload.photo
}

async function forwardUtFileToServer(file: File, item: UploadThingFileResult): Promise<PhotoDto> {
  const publicUrl = utPublicUrl(item)
  if (!publicUrl) {
    throw new Error('UploadThing returned no file URL (expected ufsUrl)')
  }
  return postJsonToUploadPhoto({
    uploadThingUrl: publicUrl,
    fileKey: item.key,
    filename: item.name ?? file.name,
    size: item.size ?? file.size,
    title: titleFromFile(file),
  })
}

/** Upload one or more image files through the best available pipeline. */
export async function uploadPhotoFiles(files: FileList | File[]): Promise<PhotoDto[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (list.length === 0) return []

  const ut = typeof window !== 'undefined' ? window.uploadFilesToUploadThing : undefined
  const out: PhotoDto[] = []

  if (ut) {
    try {
      const rawResults = await ut('smugmugImage', { files: list })
      if (!Array.isArray(rawResults)) {
        throw new Error('UploadThing returned an unexpected response')
      }
      for (let i = 0; i < rawResults.length; i += 1) {
        const item = normalizeUtResult(rawResults[i])
        const file = list[i]
        if (!item || !file) continue
        out.push(await forwardUtFileToServer(file, item))
      }
      if (out.length > 0) return out
      if (rawResults.length > 0) {
        throw new Error('UploadThing finished but no usable file URLs were returned')
      }
    } catch (err) {
      console.warn('[photo-upload] UploadThing path failed, trying multipart', err)
    }
  }

  for (const file of list) {
    out.push(await postMultipartFile(file))
  }
  return out
}
