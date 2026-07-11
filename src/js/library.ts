import { uploadPhotoFiles, type PhotoDto } from './photo-upload-client.js'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function showToast(message: string, isError = false): void {
  const el = document.getElementById('library-toast')
  if (!el) return
  el.textContent = message
  el.classList.toggle('error', isError)
}

async function fetchPhotos(): Promise<PhotoDto[]> {
  const res = await fetch('/api/photos', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load photos')
  const payload = (await res.json()) as { ok?: boolean; photos?: PhotoDto[] }
  return payload.photos ?? []
}

function renderGrid(photos: PhotoDto[]): void {
  const grid = document.getElementById('library-grid')
  const empty = document.getElementById('library-empty')
  if (!grid) return
  grid.innerHTML = ''
  if (empty) empty.hidden = photos.length > 0

  photos.forEach((photo) => {
    const li = document.createElement('li')
    li.className = 'library-card'
    li.dataset.photoId = photo.id
    const thumb = photo.thumbnailUrl || photo.src
    li.innerHTML = `
      <img src="${escapeHtml(thumb)}" alt="${escapeHtml(photo.title)}" loading="lazy">
      <div class="library-card-body">
        <p class="library-card-title">${escapeHtml(photo.title)}</p>
        <button type="button" class="library-delete" data-photo-id="${escapeHtml(photo.id)}">Delete</button>
      </div>
    `
    grid.appendChild(li)
  })
}

async function reload(): Promise<void> {
  try {
    renderGrid(await fetchPhotos())
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Load failed', true)
  }
}

async function uploadFiles(files: FileList | File[]): Promise<void> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (list.length === 0) {
    showToast('No image files selected', true)
    return
  }
  showToast(`Uploading ${list.length} file${list.length === 1 ? '' : 's'}…`)
  try {
    const uploaded = await uploadPhotoFiles(list)
    await reload()
    if (uploaded.length === 0) {
      showToast('No photos were saved', true)
      return
    }
    showToast(`Uploaded ${uploaded.length} photo${uploaded.length === 1 ? '' : 's'}`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Upload failed', true)
  }
}

async function deletePhoto(id: string): Promise<void> {
  if (!window.confirm('Delete this photo? It will be removed from all your gallery layouts.')) return
  const res = await fetch(`/photo-delete/${encodeURIComponent(id)}`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  const payload = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !payload.ok) {
    showToast(payload.error || 'Delete failed', true)
    return
  }
  showToast('Photo deleted')
  await reload()
}

function setupUpload(): void {
  const input = document.getElementById('library-file-input') as HTMLInputElement | null
  const zone = document.getElementById('library-dropzone')
  input?.addEventListener('change', () => {
    if (input.files?.length) void uploadFiles(input.files)
    input.value = ''
  })
  zone?.addEventListener('dragover', (e) => {
    e.preventDefault()
    zone.classList.add('drag-over')
  })
  zone?.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
  zone?.addEventListener('drop', (e) => {
    e.preventDefault()
    zone.classList.remove('drag-over')
    if (e.dataTransfer?.files?.length) void uploadFiles(e.dataTransfer.files)
  })
}

function setupGrid(): void {
  document.getElementById('library-grid')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.library-delete') as HTMLButtonElement | null
    if (!btn?.dataset.photoId) return
    void deletePhoto(btn.dataset.photoId)
  })
}

void (async () => {
  setupUpload()
  setupGrid()
  await reload()
})()
