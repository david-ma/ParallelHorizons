declare const d3: any

type CellKey = string
type Wall = 'north' | 'east' | 'south' | 'west'

type PhotoItem = {
  id: string
  title: string
  src: string
  artist?: string
  year?: string | number
}

/** One photo id per wall (empty string = none). Paintings only on walls, not in the middle of cells. */
type WallPlacements = Record<Wall, string>
type CellPlacements = Record<CellKey, WallPlacements>

type FloorplanData = {
  version: 2
  grid: { rows: number; cols: number }
  activeCells: CellKey[]
  placements: CellPlacements
  photoCatalog: PhotoItem[]
}

const GRID_ROWS = 5
const GRID_COLS = 5
const CELL_SIZE = 120
const CELL_GAP = 14
const PADDING = 18
const WALL_BAND = 24
const THUMB_SIZE = 14

const photoCatalog: PhotoItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i}`,
  title: `Photo ${i + 1}`,
  src: `/img/Artworks/${i}.jpg`,
}))

const activeCells = new Set<CellKey>()
const placements: CellPlacements = {}
let selectedPhotoId: string | null = null

function cellKey(row: number, col: number): CellKey {
  return `${row},${col}`
}

function emptyWalls(): WallPlacements {
  return { north: '', east: '', south: '', west: '' }
}

function ensureCellWalls(key: CellKey): WallPlacements {
  if (!placements[key]) placements[key] = emptyWalls()
  return placements[key]
}

function getPhoto(id: string): PhotoItem | undefined {
  return photoCatalog.find((p) => p.id === id)
}

function placardMetaLine(photo: PhotoItem): string {
  const parts: string[] = []
  if (photo.artist?.trim()) parts.push(photo.artist.trim())
  if (photo.year != null && String(photo.year).trim()) parts.push(String(photo.year).trim())
  return parts.join(' · ')
}

/** Place one photo on a wall section (replaces any existing). Only walls get art. */
function placePhoto(cell: { key: CellKey }, wall: Wall, photoId: string): void {
  const walls = ensureCellWalls(cell.key)
  walls[wall] = photoId
  selectPhoto(photoId)
  drawGrid()
  updatePreview()
}

function toData(): FloorplanData {
  return {
    version: 2,
    grid: { rows: GRID_ROWS, cols: GRID_COLS },
    activeCells: Array.from(activeCells),
    placements: JSON.parse(JSON.stringify(placements)),
    photoCatalog: photoCatalog.map((p) => ({
      id: p.id,
      title: p.title,
      src: p.src,
      ...(p.artist?.trim() ? { artist: p.artist.trim() } : {}),
      ...(p.year != null && String(p.year).trim() ? { year: p.year } : {}),
    })),
  }
}

function updatePreview(): void {
  const el = document.getElementById('json-preview') as HTMLTextAreaElement | null
  if (!el) return
  el.value = JSON.stringify(toData(), null, 2)
}

function selectPhoto(id: string | null): void {
  selectedPhotoId = id
  renderPhotoList()
  renderPlacardEditor()
}

function renderPlacardEditor(): void {
  const panel = document.getElementById('placard-editor')
  const titleInput = document.getElementById('placard-title') as HTMLInputElement | null
  const artistInput = document.getElementById('placard-artist') as HTMLInputElement | null
  const yearInput = document.getElementById('placard-year') as HTMLInputElement | null
  const preview = document.getElementById('placard-preview')
  if (!panel || !titleInput || !artistInput || !yearInput || !preview) return

  const photo = selectedPhotoId ? getPhoto(selectedPhotoId) : undefined
  panel.classList.toggle('placard-empty', !photo)

  if (!photo) {
    titleInput.value = ''
    artistInput.value = ''
    yearInput.value = ''
    preview.innerHTML = ''
    return
  }

  titleInput.value = photo.title
  artistInput.value = photo.artist ?? ''
  yearInput.value = photo.year != null ? String(photo.year) : ''

  const titleHtml = photo.title.trim()
    ? `<div class="pv-title">${escapeHtml(photo.title.trim())}</div>`
    : ''
  const artistHtml = photo.artist?.trim()
    ? `<div class="pv-artist">${escapeHtml(photo.artist.trim())}</div>`
    : ''
  const yearHtml =
    photo.year != null && String(photo.year).trim()
      ? `<div class="pv-year">${escapeHtml(String(photo.year).trim())}</div>`
      : ''
  preview.innerHTML = titleHtml || artistHtml || yearHtml ? titleHtml + artistHtml + yearHtml : '<div class="pv-year">(empty placard)</div>'
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function applyPlacardFromForm(): void {
  if (!selectedPhotoId) return
  const photo = getPhoto(selectedPhotoId)
  const titleInput = document.getElementById('placard-title') as HTMLInputElement | null
  const artistInput = document.getElementById('placard-artist') as HTMLInputElement | null
  const yearInput = document.getElementById('placard-year') as HTMLInputElement | null
  if (!photo || !titleInput || !artistInput || !yearInput) return

  photo.title = titleInput.value
  const artist = artistInput.value.trim()
  if (artist) photo.artist = artist
  else delete photo.artist
  const yearRaw = yearInput.value.trim()
  if (yearRaw) {
    const asNum = Number(yearRaw)
    photo.year = Number.isFinite(asNum) && String(asNum) === yearRaw ? asNum : yearRaw
  } else {
    delete photo.year
  }

  renderPhotoList()
  renderPlacardEditor()
  updatePreview()
}

function renderPhotoList(): void {
  const list = document.getElementById('photo-list')
  if (!list) return
  list.innerHTML = ''

  photoCatalog.forEach((photo) => {
    const bindDragPayload = (node: HTMLElement) => {
      node.draggable = true
      node.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', photo.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove'
      })
    }

    const tile = document.createElement('div')
    tile.className = `photo-tile${selectedPhotoId === photo.id ? ' selected' : ''}`
    tile.dataset.photoId = photo.id
    const meta = placardMetaLine(photo)
    tile.innerHTML = `<img src="${photo.src}" alt="${escapeHtml(photo.title)}"><p class="photo-title">${escapeHtml(photo.title)}</p>${meta ? `<p class="photo-meta">${escapeHtml(meta)}</p>` : ''}`

    tile.addEventListener('click', (event) => {
      event.stopPropagation()
      selectPhoto(photo.id)
    })

    bindDragPayload(tile)
    const img = tile.querySelector('img') as HTMLImageElement | null
    if (img) bindDragPayload(img)
    list.appendChild(tile)
  })
}

function mergePhotoCatalog(incoming: PhotoItem[]): void {
  incoming.forEach((imported) => {
    const idx = photoCatalog.findIndex((p) => p.id === imported.id)
    if (idx >= 0) {
      photoCatalog[idx] = { ...photoCatalog[idx], ...imported }
    } else {
      photoCatalog.push(imported)
    }
  })
}

function applyData(data: FloorplanData): void {
  activeCells.clear()
  Object.keys(placements).forEach((k) => delete placements[k])

  if (Array.isArray(data.photoCatalog)) {
    mergePhotoCatalog(data.photoCatalog)
  }

  ;(data.activeCells || []).forEach((k) => activeCells.add(k as CellKey))

  Object.entries((data as any).placements || {}).forEach(([k, value]) => {
    if (!activeCells.has(k)) return
    if (typeof value === 'string') {
      placements[k] = emptyWalls()
      placements[k].north = value
      return
    }
    const source = value as Partial<Record<Wall, string | string[]>>
    const asId = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
    placements[k] = {
      north: asId(source.north),
      east: asId(source.east),
      south: asId(source.south),
      west: asId(source.west),
    }
  })

  renderPhotoList()
  renderPlacardEditor()
  drawGrid()
  updatePreview()
}

function thumbPositionCenter(cell: { x: number; y: number }, wall: Wall): { x: number; y: number } {
  const cx = cell.x + CELL_SIZE / 2 - THUMB_SIZE / 2
  const cy = cell.y + CELL_SIZE / 2 - THUMB_SIZE / 2
  const bandMid = WALL_BAND / 2 - THUMB_SIZE / 2
  if (wall === 'north') return { x: cx, y: cell.y + Math.max(0, bandMid) }
  if (wall === 'south') return { x: cx, y: cell.y + CELL_SIZE - WALL_BAND + Math.max(0, bandMid) }
  if (wall === 'west') return { x: cell.x + Math.max(0, bandMid), y: cy }
  return { x: cell.x + CELL_SIZE - WALL_BAND + Math.max(0, bandMid), y: cy }
}

function drawGrid(): void {
  const svg = d3.select('#floorplan-svg')
  svg.selectAll('*').remove()

  const cells: Array<{ row: number; col: number; key: CellKey; x: number; y: number }> = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const key = cellKey(row, col)
      const x = PADDING + col * (CELL_SIZE + CELL_GAP)
      const y = PADDING + row * (CELL_SIZE + CELL_GAP)
      cells.push({ row, col, key, x, y })
    }
  }

  const group = svg.selectAll('g.cell-group').data(cells, (d: { key: string }) => d.key).enter().append('g').attr('class', 'cell-group')

  group
    .append('rect')
    .attr('class', (d: { key: CellKey }) => `cell ${activeCells.has(d.key) ? 'active' : 'inactive'}`)
    .attr('x', (d: { x: number }) => d.x)
    .attr('y', (d: { y: number }) => d.y)
    .attr('width', CELL_SIZE)
    .attr('height', CELL_SIZE)
    .on('click', (_event: MouseEvent, d: { key: CellKey }) => {
      if (activeCells.has(d.key)) {
        activeCells.delete(d.key)
        delete placements[d.key]
      } else {
        activeCells.add(d.key)
        ensureCellWalls(d.key)
      }
      drawGrid()
      updatePreview()
    })

  group
    .append('text')
    .attr('class', 'cell-label')
    .attr('x', (d: { x: number }) => d.x + 8)
    .attr('y', (d: { y: number }) => d.y + 16)
    .text((d: { row: number; col: number }) => `${d.row},${d.col}`)

  const wallZones = group
    .selectAll('rect.wall-zone')
    .data((cell: { key: CellKey; x: number; y: number }) => {
      return (['north', 'east', 'south', 'west'] as Wall[]).map((wall) => ({ cell, wall }))
    })
    .enter()
    .append('rect')
    .attr('class', 'wall-zone')
    .attr('x', (d: { cell: { x: number }; wall: Wall }) => {
      if (d.wall === 'west') return d.cell.x
      if (d.wall === 'east') return d.cell.x + CELL_SIZE - WALL_BAND
      return d.cell.x
    })
    .attr('y', (d: { cell: { y: number }; wall: Wall }) => {
      if (d.wall === 'north') return d.cell.y
      if (d.wall === 'south') return d.cell.y + CELL_SIZE - WALL_BAND
      return d.cell.y
    })
    .attr('width', (d: { wall: Wall }) => (d.wall === 'north' || d.wall === 'south' ? CELL_SIZE : WALL_BAND))
    .attr('height', (d: { wall: Wall }) => (d.wall === 'west' || d.wall === 'east' ? CELL_SIZE : WALL_BAND))
    .attr('fill', 'transparent')
    .attr('stroke', '#d4d4d4')
    .attr('stroke-dasharray', '2,2')
    .on('dragover', (event: DragEvent, d: { cell: { key: CellKey } }) => {
      if (!activeCells.has(d.cell.key)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    })
    .on('drop', (event: DragEvent, d: { cell: { key: CellKey }; wall: Wall }) => {
      if (!activeCells.has(d.cell.key)) return
      event.preventDefault()
      const photoId = event.dataTransfer?.getData('text/plain')
      if (!photoId) return
      placePhoto(d.cell, d.wall, photoId)
    })
    .on('dblclick', (event: MouseEvent, d: { cell: { key: CellKey }; wall: Wall }) => {
      const photoId = placements[d.cell.key]?.[d.wall] ?? ''
      if (!photoId) return
      event.stopPropagation()
      selectPhoto(photoId)
    })

  wallZones.each(function (this: SVGRectElement, d: { cell: { key: CellKey; x: number; y: number }; wall: Wall }) {
    const photoId = placements[d.cell.key]?.[d.wall] ?? ''
    if (!photoId) return
    const photo = getPhoto(photoId)
    if (!photo) return
    const pos = thumbPositionCenter(d.cell, d.wall)
    const parent = d3.select(this.parentNode as SVGGElement)
    parent
      .append('image')
      .attr('href', photo.src)
      .attr('x', pos.x)
      .attr('y', pos.y)
      .attr('width', THUMB_SIZE)
      .attr('height', THUMB_SIZE)
      .attr('pointer-events', 'none')
      .attr('preserveAspectRatio', 'xMidYMid slice')
    if (selectedPhotoId === photoId) {
      parent
        .append('rect')
        .attr('x', pos.x - 1)
        .attr('y', pos.y - 1)
        .attr('width', THUMB_SIZE + 2)
        .attr('height', THUMB_SIZE + 2)
        .attr('fill', 'none')
        .attr('stroke', '#0a84ff')
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none')
    }
  })
}

function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function setupPlacardEditor(): void {
  ;['placard-title', 'placard-artist', 'placard-year'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', applyPlacardFromForm)
  })
}

function setupButtons(): void {
  const exportBtn = document.getElementById('export-json')
  const downloadBtn = document.getElementById('download-layout')
  const resetBtn = document.getElementById('reset-layout')
  const importInput = document.getElementById('import-json') as HTMLInputElement | null
  const loadCurrentBtn = document.getElementById('load-current')

  exportBtn?.addEventListener('click', async () => {
    const json = JSON.stringify(toData(), null, 2)
    try {
      await navigator.clipboard.writeText(json)
      console.debug('Floorplan JSON copied to clipboard.')
    } catch (_err) {
      console.debug('Clipboard unavailable; using download fallback.')
      downloadJsonFile('gallery-floorplan.json', toData())
    }
  })

  downloadBtn?.addEventListener('click', () => {
    downloadJsonFile('gallery-floorplan.json', toData())
  })

  resetBtn?.addEventListener('click', () => {
    activeCells.clear()
    Object.keys(placements).forEach((k) => delete placements[k])
    selectPhoto(null)
    drawGrid()
    updatePreview()
  })

  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const data = JSON.parse(text) as FloorplanData
      applyData(data)
    } catch (err) {
      console.error('Failed to import floorplan JSON:', err)
    }
    importInput.value = ''
  })

  loadCurrentBtn?.addEventListener('click', async () => {
    try {
      const res = await fetch('/gallery-floorplan.json', { credentials: 'same-origin' })
      if (!res.ok) {
        console.error('No gallery-floorplan.json found.')
        return
      }
      const data = (await res.json()) as FloorplanData
      applyData(data)
    } catch (err) {
      console.error('Failed to load gallery-floorplan.json:', err)
    }
  })
}

async function boot(): Promise<void> {
  setupPlacardEditor()
  setupButtons()
  renderPhotoList()
  renderPlacardEditor()
  drawGrid()
  updatePreview()

  try {
    const res = await fetch('/gallery-floorplan.json', { credentials: 'same-origin' })
    if (res.ok) {
      const data = (await res.json()) as FloorplanData
      applyData(data)
    }
  } catch (_err) {
    // start blank when no floorplan on server
  }
}

void boot()
