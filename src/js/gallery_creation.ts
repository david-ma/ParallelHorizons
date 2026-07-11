declare const d3: any

import { WALL_TEXTURE_OPTIONS, type WallTextureStyle } from './types.js'
import { parseWallStyle } from './floorplan.js'

type CellKey = string
type Wall = 'north' | 'east' | 'south' | 'west'

type PhotoItem = {
  id: string
  title: string
  src: string
  artist?: string
  year?: string | number
}

type WallPlacements = Record<Wall, string>
type CellPlacements = Record<CellKey, WallPlacements>

type FloorplanData = {
  version: 2
  grid: { rows: number; cols: number }
  activeCells: CellKey[]
  placements: CellPlacements
  photoCatalog: PhotoItem[]
  spawn?: { cell: string; y?: number }
  wallStyle?: WallTextureStyle
}

type EditorSnapshot = {
  activeCells: CellKey[]
  placements: CellPlacements
  photoCatalog: PhotoItem[]
  selectedPhotoId: string | null
  spawnCell: CellKey
  wallStyle: WallTextureStyle
}

type WallSlot = { cell: { key: CellKey; x: number; y: number }; wall: Wall }

const GRID_ROWS = 5
const GRID_COLS = 5
const CELL_SIZE = 120
const CELL_GAP = 14
const PADDING = 18
const WALL_BAND = 38
const THUMB_SIZE = 28
const MAX_HISTORY = 100
const DRAG_FROM_MIME = 'application/x-gallery-from'
const DRAG_THRESHOLD_PX = 5
const DEFAULT_SPAWN: CellKey = '2,2'

type ArtPointerDrag = {
  photoId: string
  fromKey: CellKey
  fromWall: Wall
  ghost: HTMLImageElement
  startX: number
  startY: number
  moved: boolean
}

const photoCatalog: PhotoItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i}`,
  title: `Photo ${i + 1}`,
  src: `/img/Artworks/${i}.jpg`,
}))

const activeCells = new Set<CellKey>()
const placements: CellPlacements = {}
const undoStack: EditorSnapshot[] = []
const redoStack: EditorSnapshot[] = []

let selectedPhotoId: string | null = null
let spawnCell: CellKey = DEFAULT_SPAWN
let wallStyle: WallTextureStyle = 'plaster'
let spawnPlacementMode = false
let showUnplacedOnly = false
let placardHistoryCommitted = false
let artPointerDrag: ArtPointerDrag | null = null
let highlightedWallZone: SVGRectElement | null = null
let suppressArtClick = false

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

function getPlacedPhotoIds(): Set<string> {
  const ids = new Set<string>()
  Object.values(placements).forEach((walls) => {
    ;(['north', 'east', 'south', 'west'] as Wall[]).forEach((w) => {
      const id = walls[w]
      if (id) ids.add(id)
    })
  })
  return ids
}

function placardMetaLine(photo: PhotoItem): string {
  const parts: string[] = []
  if (photo.artist?.trim()) parts.push(photo.artist.trim())
  if (photo.year != null && String(photo.year).trim()) parts.push(String(photo.year).trim())
  return parts.join(' · ')
}

function cloneState(): EditorSnapshot {
  return {
    activeCells: Array.from(activeCells),
    placements: JSON.parse(JSON.stringify(placements)) as CellPlacements,
    photoCatalog: JSON.parse(JSON.stringify(photoCatalog)) as PhotoItem[],
    selectedPhotoId,
    spawnCell,
    wallStyle,
  }
}

function restoreState(snap: EditorSnapshot): void {
  activeCells.clear()
  snap.activeCells.forEach((k) => activeCells.add(k))
  Object.keys(placements).forEach((k) => delete placements[k])
  Object.assign(placements, JSON.parse(JSON.stringify(snap.placements)))
  photoCatalog.length = 0
  photoCatalog.push(...JSON.parse(JSON.stringify(snap.photoCatalog)))
  selectedPhotoId = snap.selectedPhotoId
  spawnCell = snap.spawnCell
  wallStyle = snap.wallStyle
  spawnPlacementMode = false
  updateSpawnUI()
  updateWallStyleUI()
  renderAll()
}

function commitHistory(): void {
  undoStack.push(cloneState())
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack.length = 0
}

function mutate(action: () => void): void {
  commitHistory()
  action()
  renderAll()
}

function undo(): void {
  if (undoStack.length === 0) return
  redoStack.push(cloneState())
  restoreState(undoStack.pop()!)
  showToast('Undid last change')
}

function redo(): void {
  if (redoStack.length === 0) return
  undoStack.push(cloneState())
  restoreState(redoStack.pop()!)
  showToast('Redid')
}

function renderAll(): void {
  renderPhotoList()
  renderPlacardEditor()
  drawGrid()
  updatePreview()
  updateSpawnUI()
  updateWallStyleUI()
}

function movePhoto(fromKey: CellKey, fromWall: Wall, toKey: CellKey, toWall: Wall): void {
  if (!activeCells.has(toKey)) return
  const photoId = placements[fromKey]?.[fromWall]
  if (!photoId) return
  if (fromKey === toKey && fromWall === toWall) return
  ensureCellWalls(fromKey)
  ensureCellWalls(toKey)
  const displaced = placements[toKey]![toWall]
  placements[toKey]![toWall] = photoId
  placements[fromKey]![fromWall] = displaced || ''
  selectedPhotoId = photoId
}

function setPhotoOnWall(cell: CellKey, wall: Wall, photoId: string): void {
  if (!activeCells.has(cell)) return
  ensureCellWalls(cell)
  placements[cell][wall] = photoId
  selectedPhotoId = photoId
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
    spawn: { cell: spawnCell, y: 1.75 },
    wallStyle,
  }
}

function updatePreview(): void {
  const el = document.getElementById('json-preview') as HTMLTextAreaElement | null
  if (!el) return
  el.value = JSON.stringify(toData(), null, 2)
}

function showToast(message: string, isError = false): void {
  const el = document.getElementById('editor-toast')
  if (!el) return
  el.textContent = message
  el.classList.toggle('error', isError)
  if (!isError) {
    window.setTimeout(() => {
      if (el.textContent === message) el.textContent = ''
    }, 4000)
  }
}

function updateSpawnUI(): void {
  const status = document.getElementById('spawn-status')
  const btn = document.getElementById('set-spawn')
  if (status) status.textContent = `Start: cell ${spawnCell.replace(',', ', ')}`
  if (btn) btn.classList.toggle('active', spawnPlacementMode)
}

function selectPhoto(id: string | null): void {
  selectedPhotoId = id
  renderPhotoList()
  renderPlacardEditor()
  drawGrid()
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

  const titleHtml = photo.title.trim() ? `<div class="pv-title">${escapeHtml(photo.title.trim())}</div>` : ''
  const artistHtml = photo.artist?.trim() ? `<div class="pv-artist">${escapeHtml(photo.artist.trim())}</div>` : ''
  const yearHtml =
    photo.year != null && String(photo.year).trim()
      ? `<div class="pv-year">${escapeHtml(String(photo.year).trim())}</div>`
      : ''
  preview.innerHTML = titleHtml || artistHtml || yearHtml ? titleHtml + artistHtml + yearHtml : '<div class="pv-year">(empty placard)</div>'
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function applyPlacardFromForm(): void {
  if (!selectedPhotoId) return
  const photo = getPhoto(selectedPhotoId)
  const titleInput = document.getElementById('placard-title') as HTMLInputElement | null
  const artistInput = document.getElementById('placard-artist') as HTMLInputElement | null
  const yearInput = document.getElementById('placard-year') as HTMLInputElement | null
  if (!photo || !titleInput || !artistInput || !yearInput) return

  if (!placardHistoryCommitted) {
    commitHistory()
    placardHistoryCommitted = true
  }

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
  const placed = getPlacedPhotoIds()

  photoCatalog.forEach((photo) => {
    const isPlaced = placed.has(photo.id)
    if (showUnplacedOnly && isPlaced) return

    const bindDragPayload = (node: HTMLElement) => {
      node.draggable = true
      node.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', photo.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copyMove'
      })
    }

    const tile = document.createElement('div')
    tile.className = `photo-tile${selectedPhotoId === photo.id ? ' selected' : ''}${isPlaced ? ' placed' : ''}`
    tile.dataset.photoId = photo.id
    const meta = placardMetaLine(photo)
    tile.innerHTML = `<img src="${photo.src}" alt="${escapeHtml(photo.title)}"><p class="photo-title">${escapeHtml(photo.title)}</p>${meta ? `<p class="photo-meta">${escapeHtml(meta)}</p>` : ''}${isPlaced ? '<p class="photo-meta">On wall</p>' : ''}`

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
    if (idx >= 0) photoCatalog[idx] = { ...photoCatalog[idx], ...imported }
    else photoCatalog.push(imported)
  })
}

function updateWallStyleUI(): void {
  const sel = document.getElementById('wall-style') as HTMLSelectElement | null
  if (sel && sel.value !== wallStyle) sel.value = wallStyle
}

function loadStateFromData(data: FloorplanData): void {
  activeCells.clear()
  Object.keys(placements).forEach((k) => delete placements[k])

  if (Array.isArray(data.photoCatalog)) mergePhotoCatalog(data.photoCatalog)

  ;(data.activeCells || []).forEach((k) => activeCells.add(k as CellKey))

  Object.entries(data.placements || {}).forEach(([k, value]) => {
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

  spawnCell = typeof data.spawn?.cell === 'string' && data.spawn.cell ? (data.spawn.cell as CellKey) : DEFAULT_SPAWN
  wallStyle = parseWallStyle(data.wallStyle)
  spawnPlacementMode = false
}

function applyData(data: FloorplanData, recordHistory = false): void {
  if (recordHistory) {
    mutate(() => loadStateFromData(data))
    return
  }
  loadStateFromData(data)
  renderAll()
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

function getFloorplanSvg(): SVGSVGElement | null {
  return document.getElementById('floorplan-svg') as SVGSVGElement | null
}

function setSvgDragActive(active: boolean): void {
  getFloorplanSvg()?.classList.toggle('drag-active', active)
}

function clearWallZoneHighlight(): void {
  if (highlightedWallZone) {
    highlightedWallZone.classList.remove('drag-over')
    highlightedWallZone = null
  }
}

function wallSlotFromElement(el: Element | null): { cellKey: CellKey; wall: Wall } | null {
  const zone = el?.closest?.('.wall-zone') as SVGRectElement | null
  if (!zone) return null
  const cellKey = zone.getAttribute('data-cell-key')
  const wall = zone.getAttribute('data-wall') as Wall | null
  if (!cellKey || !wall) return null
  return { cellKey: cellKey as CellKey, wall }
}

function wallSlotAtClientPoint(clientX: number, clientY: number): { cellKey: CellKey; wall: Wall } | null {
  return wallSlotFromElement(document.elementFromPoint(clientX, clientY))
}

function highlightWallZoneAt(clientX: number, clientY: number): void {
  clearWallZoneHighlight()
  const slot = wallSlotAtClientPoint(clientX, clientY)
  if (!slot || !activeCells.has(slot.cellKey)) return
  const zone = getFloorplanSvg()?.querySelector(
    `.wall-zone[data-cell-key="${slot.cellKey}"][data-wall="${slot.wall}"]`
  ) as SVGRectElement | null
  if (zone) {
    zone.classList.add('drag-over')
    highlightedWallZone = zone
  }
}

function moveArtDragGhost(ghost: HTMLImageElement, clientX: number, clientY: number): void {
  ghost.style.left = `${clientX - THUMB_SIZE / 2}px`
  ghost.style.top = `${clientY - THUMB_SIZE / 2}px`
}

function endArtPointerDrag(): void {
  document.removeEventListener('mousemove', onArtPointerMove)
  document.removeEventListener('mouseup', onArtPointerUp)
  clearWallZoneHighlight()
  setSvgDragActive(false)
  artPointerDrag?.ghost.remove()
  artPointerDrag = null
}

function onArtPointerMove(e: MouseEvent): void {
  if (!artPointerDrag) return
  moveArtDragGhost(artPointerDrag.ghost, e.clientX, e.clientY)
  if (
    !artPointerDrag.moved &&
    (Math.abs(e.clientX - artPointerDrag.startX) > DRAG_THRESHOLD_PX ||
      Math.abs(e.clientY - artPointerDrag.startY) > DRAG_THRESHOLD_PX)
  ) {
    artPointerDrag.moved = true
  }
  if (artPointerDrag.moved) highlightWallZoneAt(e.clientX, e.clientY)
}

function onArtPointerUp(e: MouseEvent): void {
  if (!artPointerDrag) return
  const drag = artPointerDrag
  endArtPointerDrag()

  if (!drag.moved) return

  suppressArtClick = true
  const slot = wallSlotAtClientPoint(e.clientX, e.clientY)
  if (!slot || !activeCells.has(slot.cellKey)) return

  mutate(() => movePhoto(drag.fromKey, drag.fromWall, slot.cellKey, slot.wall))
}

function beginArtPointerDrag(e: MouseEvent, slot: WallSlot, photoId: string, src: string): void {
  if (e.button !== 0) return
  e.preventDefault()
  e.stopPropagation()
  selectPhoto(photoId)

  const ghost = document.createElement('img')
  ghost.src = src
  ghost.alt = ''
  ghost.className = 'art-drag-ghost'
  ghost.style.width = `${THUMB_SIZE}px`
  ghost.style.height = `${THUMB_SIZE}px`
  document.body.appendChild(ghost)
  moveArtDragGhost(ghost, e.clientX, e.clientY)

  setSvgDragActive(true)
  artPointerDrag = {
    photoId,
    fromKey: slot.cell.key,
    fromWall: slot.wall,
    ghost,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
  }

  document.addEventListener('mousemove', onArtPointerMove)
  document.addEventListener('mouseup', onArtPointerUp)
}

function handleWallDrop(event: DragEvent, slot: WallSlot): void {
  if (!activeCells.has(slot.cell.key)) return
  event.preventDefault()
  const photoId = event.dataTransfer?.getData('text/plain')
  if (!photoId || !getPhoto(photoId)) return

  const fromRaw = event.dataTransfer?.getData(DRAG_FROM_MIME)
  mutate(() => {
    if (fromRaw) {
      const [fromKey, fromWall] = fromRaw.split(':') as [CellKey, Wall]
      movePhoto(fromKey, fromWall, slot.cell.key, slot.wall)
    } else {
      setPhotoOnWall(slot.cell.key, slot.wall, photoId)
    }
  })
}

function drawGrid(): void {
  const svg = d3.select('#floorplan-svg')
  svg.selectAll('*').remove()

  const cells: Array<{ row: number; col: number; key: CellKey; x: number; y: number }> = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const key = cellKey(row, col)
      cells.push({
        row,
        col,
        key,
        x: PADDING + col * (CELL_SIZE + CELL_GAP),
        y: PADDING + row * (CELL_SIZE + CELL_GAP),
      })
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
      if (spawnPlacementMode) {
        mutate(() => {
          spawnCell = d.key
          spawnPlacementMode = false
        })
        showToast(`Start position set to cell ${d.key}`)
        return
      }
      mutate(() => {
        if (activeCells.has(d.key)) {
          activeCells.delete(d.key)
          delete placements[d.key]
        } else {
          activeCells.add(d.key)
          ensureCellWalls(d.key)
        }
      })
    })

  group
    .append('text')
    .attr('class', 'cell-label')
    .attr('x', (d: { x: number }) => d.x + 8)
    .attr('y', (d: { y: number }) => d.y + 16)
    .text((d: { row: number; col: number }) => `${d.row},${d.col}`)

  group.each(function (this: SVGGElement, d: { key: CellKey; x: number; y: number }) {
    if (d.key !== spawnCell) return
    const g = d3.select(this)
    const cx = d.x + CELL_SIZE / 2
    const cy = d.y + CELL_SIZE / 2
    g.append('circle').attr('class', 'spawn-marker spawn-marker-ring').attr('cx', cx).attr('cy', cy).attr('r', 14)
    g.append('text')
      .attr('class', 'spawn-marker spawn-marker-label')
      .attr('x', cx)
      .attr('y', cy + 4)
      .attr('text-anchor', 'middle')
      .text('▶')
  })

  const wallZones = group
    .selectAll('rect.wall-zone')
    .data((cell: { key: CellKey; x: number; y: number }) =>
      (['north', 'east', 'south', 'west'] as Wall[]).map((wall) => ({ cell, wall }))
    )
    .enter()
    .append('rect')
    .attr('class', 'wall-zone')
    .attr('x', (d: WallSlot) => {
      if (d.wall === 'west') return d.cell.x
      if (d.wall === 'east') return d.cell.x + CELL_SIZE - WALL_BAND
      return d.cell.x
    })
    .attr('y', (d: WallSlot) => {
      if (d.wall === 'north') return d.cell.y
      if (d.wall === 'south') return d.cell.y + CELL_SIZE - WALL_BAND
      return d.cell.y
    })
    .attr('width', (d: WallSlot) => (d.wall === 'north' || d.wall === 'south' ? CELL_SIZE : WALL_BAND))
    .attr('height', (d: WallSlot) => (d.wall === 'west' || d.wall === 'east' ? CELL_SIZE : WALL_BAND))
    .attr('fill', 'transparent')
    .attr('stroke', '#d4d4d4')
    .attr('stroke-dasharray', '2,2')
    .attr('data-cell-key', (d: WallSlot) => d.cell.key)
    .attr('data-wall', (d: WallSlot) => d.wall)
    .on('dragover', (event: DragEvent, d: WallSlot) => {
      if (!activeCells.has(d.cell.key)) return
      event.preventDefault()
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = event.dataTransfer.types.includes(DRAG_FROM_MIME) ? 'move' : 'copy'
      }
      d3.select(event.currentTarget).classed('drag-over', true)
    })
    .on('dragleave', (event: DragEvent) => {
      d3.select(event.currentTarget).classed('drag-over', false)
    })
    .on('drop', (event: DragEvent, d: WallSlot) => {
      d3.select(event.currentTarget).classed('drag-over', false)
      handleWallDrop(event, d)
    })
    .on('dblclick', (event: MouseEvent, d: WallSlot) => {
      const photoId = placements[d.cell.key]?.[d.wall] ?? ''
      if (!photoId) return
      event.stopPropagation()
      selectPhoto(photoId)
      activateTab('labels')
    })

  wallZones.each(function (this: SVGRectElement, slot: WallSlot) {
    const photoId = placements[slot.cell.key]?.[slot.wall] ?? ''
    if (!photoId) return
    const photo = getPhoto(photoId)
    if (!photo) return
    const pos = thumbPositionCenter(slot.cell, slot.wall)
    const parent = d3.select(this.parentNode as SVGGElement)
    const img = parent
      .append('image')
      .attr('class', 'placed-art')
      .attr('href', photo.src)
      .attr('x', pos.x)
      .attr('y', pos.y)
      .attr('width', THUMB_SIZE)
      .attr('height', THUMB_SIZE)
      .attr('preserveAspectRatio', 'xMidYMid slice')
      .style('cursor', 'grab')
      .style('pointer-events', 'all')
      .attr('data-cell-key', slot.cell.key)
      .attr('data-wall', slot.wall)
      .attr('data-photo-id', photoId)

    img
      .on('mousedown', (event: MouseEvent) => {
        beginArtPointerDrag(event, slot, photoId, photo.src)
      })
      .on('click', (event: MouseEvent) => {
        if (suppressArtClick) {
          suppressArtClick = false
          event.stopPropagation()
          return
        }
        event.stopPropagation()
        selectPhoto(photoId)
      })

    if (selectedPhotoId === photoId) {
      parent
        .append('rect')
        .attr('x', pos.x - 2)
        .attr('y', pos.y - 2)
        .attr('width', THUMB_SIZE + 4)
        .attr('height', THUMB_SIZE + 4)
        .attr('fill', 'none')
        .attr('stroke', '#0a84ff')
        .attr('stroke-width', 2)
        .attr('pointer-events', 'none')
    }
  })
}

function activateTab(name: string): void {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const el = btn as HTMLButtonElement
    const active = el.dataset.tab === name
    el.classList.toggle('active', active)
    el.setAttribute('aria-selected', active ? 'true' : 'false')
  })
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    const el = panel as HTMLElement
    el.classList.toggle('active', el.dataset.panel === name)
  })
}

function setupTabs(): void {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = (btn as HTMLButtonElement).dataset.tab
      if (name) activateTab(name)
    })
  })
}

async function saveAndPreview(): Promise<void> {
  const btn = document.getElementById('save-preview') as HTMLButtonElement | null
  if (btn) btn.disabled = true
  showToast('Saving…')
  try {
    const res = await fetch('/save-floorplan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(toData()),
    })
    const payload = (await res.json()) as { ok?: boolean; error?: string }
    if (!res.ok || !payload.ok) {
      showToast(payload.error || 'Save failed', true)
      return
    }
    showToast('Saved — opening preview…')
    window.open('/view/parallel-horizons', '_blank', 'noopener')
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Save failed', true)
  } finally {
    if (btn) btn.disabled = false
  }
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
    const el = document.getElementById(id)
    el?.addEventListener('input', applyPlacardFromForm)
    el?.addEventListener('blur', () => {
      placardHistoryCommitted = false
    })
  })
}

function setupPhotoListDragPassthrough(): void {
  const list = document.getElementById('photo-list')
  if (!list) return
  list.addEventListener('dragstart', () => setSvgDragActive(true))
  list.addEventListener('dragend', () => {
    setSvgDragActive(false)
    clearWallZoneHighlight()
  })
}

function setupUndoRedo(): void {
  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
      e.preventDefault()
      redo()
    }
  })
}

function setupWallStyleSelect(): void {
  const sel = document.getElementById('wall-style') as HTMLSelectElement | null
  if (!sel) return
  if (sel.options.length === 0) {
    WALL_TEXTURE_OPTIONS.forEach(({ value, label, hint }) => {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = `${label} — ${hint}`
      sel.appendChild(opt)
    })
  }
  sel.addEventListener('change', () => {
    const next = parseWallStyle(sel.value)
    if (next === wallStyle) return
    mutate(() => {
      wallStyle = next
    })
  })
  updateWallStyleUI()
}

function setupButtons(): void {
  document.getElementById('save-preview')?.addEventListener('click', () => void saveAndPreview())

  document.getElementById('set-spawn')?.addEventListener('click', () => {
    spawnPlacementMode = !spawnPlacementMode
    updateSpawnUI()
    showToast(spawnPlacementMode ? 'Click a cell to set the start position' : 'Start placement cancelled')
  })

  document.getElementById('filter-unplaced')?.addEventListener('change', (e) => {
    showUnplacedOnly = (e.target as HTMLInputElement).checked
    renderPhotoList()
  })

  document.getElementById('export-json')?.addEventListener('click', async () => {
    const json = JSON.stringify(toData(), null, 2)
    try {
      await navigator.clipboard.writeText(json)
      showToast('JSON copied to clipboard')
    } catch (_err) {
      downloadJsonFile('gallery-floorplan.json', toData())
      showToast('Downloaded JSON (clipboard unavailable)')
    }
  })

  document.getElementById('download-layout')?.addEventListener('click', () => {
    downloadJsonFile('gallery-floorplan.json', toData())
    showToast('Downloaded gallery-floorplan.json')
  })

  document.getElementById('reset-layout')?.addEventListener('click', () => {
    if (!window.confirm('Reset the entire layout? You can undo with Ctrl+Z.')) return
    mutate(() => {
      activeCells.clear()
      Object.keys(placements).forEach((k) => delete placements[k])
      spawnCell = DEFAULT_SPAWN
      wallStyle = 'plaster'
      selectedPhotoId = null
    })
  })

  const importInput = document.getElementById('import-json') as HTMLInputElement | null
  importInput?.addEventListener('change', async () => {
    const file = importInput.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as FloorplanData
      applyData(data, true)
      showToast('Imported floorplan')
    } catch (err) {
      console.error('Failed to import floorplan JSON:', err)
      showToast('Import failed — invalid JSON', true)
    }
    importInput.value = ''
  })

  document.getElementById('load-current')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/galleries/parallel-horizons.json', { credentials: 'same-origin' })
      if (!res.ok) {
        showToast('No parallel-horizons floorplan on server', true)
        return
      }
      applyData((await res.json()) as FloorplanData, true)
      showToast('Loaded current floorplan')
    } catch (err) {
      console.error('Failed to load parallel-horizons floorplan:', err)
      showToast('Load failed', true)
    }
  })
}

async function boot(): Promise<void> {
  setupTabs()
  setupPlacardEditor()
  setupPhotoListDragPassthrough()
  setupUndoRedo()
  setupWallStyleSelect()
  setupButtons()
  renderAll()

  try {
    const res = await fetch('/galleries/parallel-horizons.json', { credentials: 'same-origin' })
    if (res.ok) applyData((await res.json()) as FloorplanData, false)
  } catch (_err) {
    // blank editor
  }
}

void boot()
