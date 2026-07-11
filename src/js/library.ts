import { uploadPhotoFiles, type PhotoDto, type UploadFileProgress } from './photo-upload-client.js'
import { buildLibraryPendingCard } from './photo-upload-ui.js'

type FolderDto = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

type FolderFilter = 'all' | 'root' | string

const state = {
  folders: [] as FolderDto[],
  photos: [] as PhotoDto[],
  pendingUploads: [] as UploadFileProgress[],
  folderFilter: 'all' as FolderFilter,
  search: '',
  unplacedOnly: false,
  selected: new Set<string>(),
  lastGridIndex: -1,
}

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

function uploadFolderId(): string | null {
  if (state.folderFilter === 'all' || state.folderFilter === 'root') return null
  return state.folderFilter
}

function photosQuery(): string {
  const params = new URLSearchParams()
  if (state.folderFilter === 'root') params.set('folderId', 'root')
  else if (state.folderFilter !== 'all') params.set('folderId', state.folderFilter)
  if (state.search.trim()) params.set('q', state.search.trim())
  if (state.unplacedOnly) params.set('unplaced', '1')
  const qs = params.toString()
  return qs ? `/api/photos?${qs}` : '/api/photos'
}

async function fetchFolders(): Promise<FolderDto[]> {
  const res = await fetch('/api/folders', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load folders')
  const payload = (await res.json()) as { folders?: FolderDto[] }
  return payload.folders ?? []
}

async function fetchPhotos(): Promise<PhotoDto[]> {
  const res = await fetch(photosQuery(), { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Could not load photos')
  const payload = (await res.json()) as { photos?: PhotoDto[] }
  return payload.photos ?? []
}

function folderDepth(folder: FolderDto, byId: Map<string, FolderDto>): number {
  let depth = 0
  let parentId = folder.parentId
  while (parentId) {
    depth += 1
    parentId = byId.get(parentId)?.parentId ?? null
  }
  return depth
}

function sortedFolders(): FolderDto[] {
  const byId = new Map(state.folders.map((f) => [f.id, f]))
  return [...state.folders].sort((a, b) => {
    const da = folderDepth(a, byId)
    const db = folderDepth(b, byId)
    if (da !== db) return da - db
    return a.name.localeCompare(b.name)
  })
}

function renderFolderTree(): void {
  const tree = document.getElementById('folder-tree')
  const moveSelect = document.getElementById('library-bulk-move') as HTMLSelectElement | null
  if (!tree) return
  tree.innerHTML = ''

  const items: { id: FolderFilter; label: string; depth: number }[] = [
    { id: 'all', label: 'All photos', depth: 0 },
    { id: 'root', label: 'Unsorted', depth: 0 },
  ]
  const byId = new Map(state.folders.map((f) => [f.id, f]))
  for (const folder of sortedFolders()) {
    items.push({ id: folder.id, label: folder.name, depth: folderDepth(folder, byId) + 1 })
  }

  items.forEach(({ id, label, depth }) => {
    const li = document.createElement('li')
    li.className = `folder-tree-item${state.folderFilter === id ? ' active' : ''}`
    li.style.paddingLeft = `${0.5 + depth * 0.75}rem`
    li.innerHTML = `
      <button type="button" class="folder-tree-btn" data-folder-id="${escapeHtml(id)}">${escapeHtml(label)}</button>
      ${id !== 'all' && id !== 'root' ? `<button type="button" class="folder-rename" data-folder-id="${escapeHtml(id)}" title="Rename">✎</button><button type="button" class="folder-delete" data-folder-id="${escapeHtml(id)}" title="Delete">×</button>` : ''}
    `
    tree.appendChild(li)
  })

  if (moveSelect) {
    const current = moveSelect.value
    moveSelect.innerHTML = '<option value="">Move to…</option><option value="root">Unsorted</option>'
    for (const folder of sortedFolders()) {
      const opt = document.createElement('option')
      opt.value = folder.id
      opt.textContent = folder.name
      moveSelect.appendChild(opt)
    }
    moveSelect.value = current
  }
}

function updateBulkBar(): void {
  const bar = document.getElementById('library-bulk')
  const count = document.getElementById('library-bulk-count')
  if (!bar || !count) return
  const n = state.selected.size
  bar.hidden = n === 0
  count.textContent = n === 1 ? '1 selected' : `${n} selected`
}

function renderGrid(): void {
  const grid = document.getElementById('library-grid')
  const empty = document.getElementById('library-empty')
  if (!grid) return
  grid.innerHTML = ''
  const hasItems = state.photos.length > 0 || state.pendingUploads.length > 0
  if (empty) empty.hidden = hasItems

  state.pendingUploads.forEach((pending) => {
    const li = document.createElement('li')
    li.className = `library-card upload-pending${pending.stage === 'error' ? ' upload-error' : ''}`
    li.dataset.uploadId = pending.localId
    li.innerHTML = buildLibraryPendingCard(pending)
    grid.appendChild(li)
  })

  state.photos.forEach((photo, index) => {
    const selected = state.selected.has(photo.id)
    const li = document.createElement('li')
    li.className = `library-card${selected ? ' selected' : ''}`
    li.dataset.photoId = photo.id
    li.dataset.gridIndex = String(index)
    const thumb = photo.thumbnailUrl || photo.src
    const meta = [photo.artist, photo.year].filter(Boolean).join(' · ')
    li.innerHTML = `
      <label class="library-select-wrap">
        <input type="checkbox" class="library-select" data-photo-id="${escapeHtml(photo.id)}"${selected ? ' checked' : ''}>
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(photo.title)}" loading="lazy">
      </label>
      <div class="library-card-body">
        <p class="photo-title">${escapeHtml(photo.title)}</p>
        ${meta ? `<p class="photo-meta">${escapeHtml(meta)}</p>` : ''}
        <button type="button" class="library-delete" data-photo-id="${escapeHtml(photo.id)}">Delete</button>
      </div>
    `
    grid.appendChild(li)
  })
  updateBulkBar()
}

async function reloadAll(): Promise<void> {
  try {
    state.folders = await fetchFolders()
    state.photos = await fetchPhotos()
    state.selected.forEach((id) => {
      if (!state.photos.some((p) => p.id === id)) state.selected.delete(id)
    })
    renderFolderTree()
    renderGrid()
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Load failed', true)
  }
}

async function createFolder(): Promise<void> {
  const name = window.prompt('Folder name')
  if (!name?.trim()) return
  let parentId: string | null = null
  if (state.folderFilter !== 'all' && state.folderFilter !== 'root') {
    parentId = state.folderFilter
  }
  const res = await fetch('/folder-create', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim(), parentId }),
  })
  const payload = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !payload.ok) {
    showToast(payload.error || 'Could not create folder', true)
    return
  }
  showToast('Folder created')
  await reloadAll()
}

async function renameFolder(folderId: string): Promise<void> {
  const folder = state.folders.find((f) => f.id === folderId)
  const name = window.prompt('Rename folder', folder?.name ?? '')
  if (!name?.trim()) return
  const res = await fetch(`/folder-update/${encodeURIComponent(folderId)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() }),
  })
  const payload = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !payload.ok) {
    showToast(payload.error || 'Rename failed', true)
    return
  }
  showToast('Folder renamed')
  await reloadAll()
}

async function deleteFolder(folderId: string): Promise<void> {
  if (!window.confirm('Delete this folder? Photos inside move to Unsorted.')) return
  const res = await fetch(`/folder-delete/${encodeURIComponent(folderId)}`, {
    method: 'POST',
    credentials: 'same-origin',
  })
  const payload = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !payload.ok) {
    showToast(payload.error || 'Delete failed', true)
    return
  }
  if (state.folderFilter === folderId) state.folderFilter = 'all'
  showToast('Folder deleted')
  await reloadAll()
}

async function uploadFiles(files: FileList | File[]): Promise<void> {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  if (list.length === 0) {
    showToast('No image files selected', true)
    return
  }
  const pendingIds = new Set<string>()
  try {
    const uploaded = await uploadPhotoFiles(list, {
      folderId: uploadFolderId(),
      onProgress: (progress) => {
        pendingIds.add(progress.localId)
        const idx = state.pendingUploads.findIndex((p) => p.localId === progress.localId)
        if (idx >= 0) state.pendingUploads[idx] = progress
        else state.pendingUploads.push(progress)
        if (progress.stage === 'error') pendingIds.delete(progress.localId)
        renderGrid()
      },
    })
    state.pendingUploads = state.pendingUploads.filter((p) => pendingIds.has(p.localId) && p.stage === 'error')
    await reloadAll()
    if (uploaded.length === 0 && state.pendingUploads.length === 0) {
      showToast('No photos were saved', true)
      return
    }
    if (uploaded.length > 0) {
      showToast(`Uploaded ${uploaded.length} photo${uploaded.length === 1 ? '' : 's'}`)
    }
    if (state.pendingUploads.length > 0) {
      showToast(`${state.pendingUploads.length} upload${state.pendingUploads.length === 1 ? '' : 's'} failed`, true)
    }
  } catch (err) {
    state.pendingUploads = state.pendingUploads.filter((p) => p.stage === 'error')
    renderGrid()
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
  state.selected.delete(id)
  showToast('Photo deleted')
  await reloadAll()
}

async function bulkAction(action: 'move' | 'delete' | 'update', extra: Record<string, unknown> = {}): Promise<void> {
  const photoIds = [...state.selected]
  if (photoIds.length === 0) return
  const res = await fetch('/photos-bulk', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, photoIds, ...extra }),
  })
  const payload = (await res.json()) as { ok?: boolean; error?: string }
  if (!res.ok || !payload.ok) {
    showToast(payload.error || 'Bulk action failed', true)
    return
  }
  state.selected.clear()
  await reloadAll()
}

function toggleSelection(photoId: string, index: number, extend: boolean): void {
  if (extend && state.lastGridIndex >= 0) {
    const start = Math.min(state.lastGridIndex, index)
    const end = Math.max(state.lastGridIndex, index)
    for (let i = start; i <= end; i++) {
      const id = state.photos[i]?.id
      if (id) state.selected.add(id)
    }
  } else if (state.selected.has(photoId)) {
    state.selected.delete(photoId)
  } else {
    state.selected.add(photoId)
  }
  state.lastGridIndex = index
  renderGrid()
}

function setupFolderTree(): void {
  document.getElementById('folder-create-btn')?.addEventListener('click', () => void createFolder())
  document.getElementById('folder-tree')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const rename = target.closest('.folder-rename') as HTMLElement | null
    if (rename?.dataset.folderId) {
      e.stopPropagation()
      void renameFolder(rename.dataset.folderId)
      return
    }
    const del = target.closest('.folder-delete') as HTMLElement | null
    if (del?.dataset.folderId) {
      e.stopPropagation()
      void deleteFolder(del.dataset.folderId)
      return
    }
    const btn = target.closest('.folder-tree-btn') as HTMLElement | null
    if (!btn?.dataset.folderId) return
    state.folderFilter = btn.dataset.folderId as FolderFilter
    renderFolderTree()
    void reloadAll()
  })
}

function setupToolbar(): void {
  const search = document.getElementById('library-search') as HTMLInputElement | null
  let searchTimer: number | undefined
  search?.addEventListener('input', () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => {
      state.search = search.value
      void reloadAll()
    }, 250)
  })
  document.getElementById('library-unplaced')?.addEventListener('change', (e) => {
    state.unplacedOnly = (e.target as HTMLInputElement).checked
    void reloadAll()
  })
  document.getElementById('library-bulk-move')?.addEventListener('change', (e) => {
    const val = (e.target as HTMLSelectElement).value
    if (!val) return
    void bulkAction('move', { folderId: val === 'root' ? null : val }).finally(() => {
      ;(e.target as HTMLSelectElement).value = ''
    })
  })
  document.getElementById('library-bulk-delete')?.addEventListener('click', () => {
    if (!window.confirm(`Delete ${state.selected.size} photo(s)?`)) return
    void bulkAction('delete')
  })
  const dialog = document.getElementById('library-labels-dialog') as HTMLDialogElement | null
  const form = document.getElementById('library-labels-form') as HTMLFormElement | null
  document.getElementById('library-bulk-labels')?.addEventListener('click', () => {
    form?.reset()
    dialog?.showModal()
  })
  document.getElementById('library-labels-cancel')?.addEventListener('click', () => dialog?.close())
  form?.addEventListener('submit', (e) => {
    e.preventDefault()
    const data = new FormData(form)
    const title = String(data.get('title') ?? '')
    const artist = String(data.get('artist') ?? '')
    const year = String(data.get('year') ?? '')
    dialog?.close()
    void bulkAction('update', { title, artist, year })
  })
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
    const target = e.target as HTMLElement
    const del = target.closest('.library-delete') as HTMLButtonElement | null
    if (del?.dataset.photoId) {
      void deletePhoto(del.dataset.photoId)
      return
    }
    const card = target.closest('.library-card') as HTMLElement | null
    const checkbox = target.closest('.library-select') as HTMLInputElement | null
    if (!card?.dataset.photoId) return
    const index = Number(card.dataset.gridIndex ?? -1)
    if (checkbox || target.closest('.library-select-wrap')) {
      toggleSelection(card.dataset.photoId, index, (e as MouseEvent).shiftKey)
    }
  })
}

void (async () => {
  setupFolderTree()
  setupToolbar()
  setupUpload()
  setupGrid()
  await reloadAll()
})()
