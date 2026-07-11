/**
 * Browser upload helper — UploadThing when available, else multipart to /uploadPhoto.
 */
export type PhotoDto = {
  id: string
  title: string
  src: string
  thumbnailUrl: string
  folderId?: string | null
  artist?: string
  year?: string
  filename?: string
}

export type UploadStage = 'queued' | 'cloud' | 'processing' | 'error'

export type UploadFileProgress = {
  localId: string
  filename: string
  title: string
  stage: UploadStage
  error?: string
}

export type UploadPhotoOptions = {
  folderId?: string | null
  onProgress?: (progress: UploadFileProgress) => void
}

type UploadThingFileResult = {
  url?: string
  ufsUrl?: string
  appUrl?: string
  key?: string
  name?: string
  size?: number
}

type FileUploadJob = {
  localId: string
  file: File
  title: string
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

function newLocalId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

function reportProgress(
  onProgress: UploadPhotoOptions['onProgress'],
  job: FileUploadJob,
  stage: UploadStage,
  error?: string
): void {
  onProgress?.({
    localId: job.localId,
    filename: job.file.name,
    title: job.title,
    stage,
    error,
  })
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

async function postMultipartFile(file: File, folderId?: string | null): Promise<PhotoDto> {
  const form = new FormData()
  form.append('fileToUpload', file)
  form.append('title', titleFromFile(file))
  if (folderId) form.append('folderId', folderId)
  const res = await fetch('/uploadPhoto', { method: 'POST', body: form, credentials: 'same-origin' })
  const payload = (await res.json()) as { ok?: boolean; photo?: PhotoDto; error?: string }
  if (!res.ok || !payload.ok || !payload.photo) {
    throw new Error(payload.error || 'Upload failed')
  }
  return payload.photo
}

async function forwardUtFileToServer(
  file: File,
  item: UploadThingFileResult,
  folderId?: string | null
): Promise<PhotoDto> {
  const publicUrl = utPublicUrl(item)
  if (!publicUrl) {
    throw new Error('UploadThing returned no file URL (expected ufsUrl)')
  }
  const body: Record<string, unknown> = {
    uploadThingUrl: publicUrl,
    fileKey: item.key,
    filename: item.name ?? file.name,
    size: item.size ?? file.size,
    title: titleFromFile(file),
  }
  if (folderId) body.folderId = folderId
  return postJsonToUploadPhoto(body)
}

async function uploadJobMultipart(
  job: FileUploadJob,
  folderId: string | null,
  onProgress: UploadPhotoOptions['onProgress']
): Promise<PhotoDto> {
  reportProgress(onProgress, job, 'cloud')
  try {
    return await postMultipartFile(job.file, folderId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    reportProgress(onProgress, job, 'error', message)
    throw err
  }
}

async function saveUtJob(
  job: FileUploadJob,
  item: UploadThingFileResult,
  folderId: string | null,
  onProgress: UploadPhotoOptions['onProgress']
): Promise<PhotoDto> {
  reportProgress(onProgress, job, 'processing')
  try {
    return await forwardUtFileToServer(job.file, item, folderId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    reportProgress(onProgress, job, 'error', message)
    throw err
  }
}

/** Upload one or more image files through the best available pipeline. */
export async function uploadPhotoFiles(
  files: FileList | File[],
  options: UploadPhotoOptions = {}
): Promise<PhotoDto[]> {
  const folderId = options.folderId ?? null
  const onProgress = options.onProgress
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (list.length === 0) return []

  const jobs: FileUploadJob[] = list.map((file) => ({
    localId: newLocalId(),
    file,
    title: titleFromFile(file),
  }))
  jobs.forEach((job) => reportProgress(onProgress, job, 'queued'))

  const ut = typeof window !== 'undefined' ? window.uploadFilesToUploadThing : undefined
  const out: PhotoDto[] = []
  const pending = new Set(jobs.map((j) => j.localId))

  const finishJob = (job: FileUploadJob, photo: PhotoDto): void => {
    pending.delete(job.localId)
    out.push(photo)
  }

  const failJob = (job: FileUploadJob, err: unknown): void => {
    pending.delete(job.localId)
    const message = err instanceof Error ? err.message : 'Upload failed'
    reportProgress(onProgress, job, 'error', message)
  }

  if (ut) {
    try {
      jobs.forEach((job) => reportProgress(onProgress, job, 'cloud'))
      const rawResults = await ut('smugmugImage', { files: list })
      if (!Array.isArray(rawResults)) {
        throw new Error('UploadThing returned an unexpected response')
      }

      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i]
        const item = normalizeUtResult(rawResults[i])
        if (!job || !item) continue
        try {
          finishJob(job, await saveUtJob(job, item, folderId, onProgress))
        } catch (err) {
          failJob(job, err)
        }
      }

      if (out.length > 0 && pending.size === 0) return out
      if (rawResults.length > 0 && out.length === 0 && pending.size === jobs.length) {
        throw new Error('UploadThing finished but no usable file URLs were returned')
      }
    } catch (err) {
      console.warn('[photo-upload] UploadThing path failed, trying multipart', err)
      jobs.forEach((job) => {
        if (pending.has(job.localId)) reportProgress(onProgress, job, 'cloud')
      })
    }
  }

  for (const job of jobs) {
    if (!pending.has(job.localId)) continue
    try {
      finishJob(job, await uploadJobMultipart(job, folderId, onProgress))
    } catch {
      // error already reported
    }
  }

  return out
}
