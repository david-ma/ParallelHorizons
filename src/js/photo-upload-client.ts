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
  key?: string
  name?: string
  size?: number
}

declare global {
  interface Window {
    uploadFilesToUploadThing?: (
      route: string,
      opts: { files: File[] }
    ) => Promise<UploadThingFileResult[]>
  }
}

function titleFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || file.name
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

/** Upload one or more image files through the best available pipeline. */
export async function uploadPhotoFiles(files: FileList | File[]): Promise<PhotoDto[]> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (list.length === 0) return []

  const ut = typeof window !== 'undefined' ? window.uploadFilesToUploadThing : undefined
  const out: PhotoDto[] = []

  if (ut) {
    try {
      const uploaded = await ut('smugmugImage', { files: list })
      for (let i = 0; i < uploaded.length; i += 1) {
        const item = uploaded[i]
        const file = list[i]
        if (!item?.url || !file) continue
        out.push(
          await postJsonToUploadPhoto({
            uploadThingUrl: item.url,
            fileKey: item.key,
            filename: item.name ?? file.name,
            size: item.size ?? file.size,
            title: titleFromFile(file),
          })
        )
      }
      if (out.length > 0) return out
    } catch {
      // fall through to multipart
    }
  }

  for (const file of list) {
    out.push(await postMultipartFile(file))
  }
  return out
}
