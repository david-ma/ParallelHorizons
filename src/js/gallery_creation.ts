declare const d3: any

type CellKey = string
type Wall = 'north' | 'east' | 'south' | 'west'

type PhotoItem = {
  id: string
  title: string
  src: string
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
const THUMB_GAP = 2

const photoCatalog: PhotoItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i}`,
  title: `Photo ${i + 1}`,
  src: `/img/Artworks/${i}.jpg`,
}))

const activeCells = new Set<CellKey>()
const placements: CellPlacements = {}

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

function nearestWall(
  cell: { x: number; y: number },
  clientX: number,
  clientY: number,
  svgRect: DOMRect
): Wall {
  const px = clientX - svgRect.left
  const py = clientY - svgRect.top
  const leftDist = Math.abs(px - cell.x)
  const rightDist = Math.abs(px - (cell.x + CELL_SIZE))
  const topDist = Math.abs(py - cell.y)
  const bottomDist = Math.abs(py - (cell.y + CELL_SIZE))

  const min = Math.min(leftDist, rightDist, topDist, bottomDist)
  if (min === topDist) return 'north'
  if (min === rightDist) return 'east'
  if (min === bottomDist) return 'south'
  return 'west'
}

/** Place one photo on a wall section (replaces any existing). Only walls get art. */
function placePhoto(cell: { key: CellKey }, wall: Wall, photoId: string): void {
  const walls = ensureCellWalls(cell.key)
  walls[wall] = photoId
  drawGrid()
  updatePreview()
}

function toData(): FloorplanData {
  return {
    version: 2,
    grid: { rows: GRID_ROWS, cols: GRID_COLS },
    activeCells: Array.from(activeCells),
    placements: JSON.parse(JSON.stringify(placements)),
    photoCatalog,
  }
}

function updatePreview(): void {
  const el = document.getElementById('json-preview') as HTMLTextAreaElement | null
  if (!el) return
  el.value = JSON.stringify(toData(), null, 2)
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
    tile.className = 'photo-tile'
    tile.dataset.photoId = photo.id
    tile.innerHTML = `<img src="${photo.src}" alt="${photo.title}"><p class="photo-title">${photo.title}</p>`
    bindDragPayload(tile)
    const img = tile.querySelector('img') as HTMLImageElement | null
    if (img) bindDragPayload(img)
    list.appendChild(tile)
  })
}

function applyData(data: FloorplanData): void {
  activeCells.clear()
  Object.keys(placements).forEach((k) => delete placements[k])

  ;(data.activeCells || []).forEach((k) => activeCells.add(k as CellKey))

  Object.entries((data as any).placements || {}).forEach(([k, value]) => {
    if (!activeCells.has(k)) return
    // Backward compatibility: whole-cell string or old array-per-wall shape.
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

  drawGrid()
  updatePreview()
}

/** Position for the single thumbnail: center of the wall section (edge band), not at corners. */
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
        delete placements[d.key] // Deactivating a square removes all its artworks
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

  // One thumbnail per wall section, centered on the wall band (not at corners)
  wallZones.each(function (this: SVGRectElement, d: { cell: { key: CellKey; x: number; y: number }; wall: Wall }) {
    const photoId = placements[d.cell.key]?.[d.wall] ?? ''
    if (!photoId) return
    const photo = photoCatalog.find((p) => p.id === photoId)
    if (!photo) return
    const pos = thumbPositionCenter(d.cell, d.wall)
    d3.select(this.parentNode as SVGGElement)
      .append('image')
      .attr('href', photo.src)
      .attr('x', pos.x)
      .attr('y', pos.y)
      .attr('width', THUMB_SIZE)
      .attr('height', THUMB_SIZE)
      .attr('pointer-events', 'none')
      .attr('preserveAspectRatio', 'xMidYMid slice')
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

function setupButtons(): void {
  const exportBtn = document.getElementById('export-json')
  const downloadBtn = document.getElementById('download-layout')
  const resetBtn = document.getElementById('reset-layout')
  const importInput = document.getElementById('import-json') as HTMLInputElement | null

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
  })
}

function boot(): void {
  renderPhotoList()
  drawGrid()
  updatePreview()
  setupButtons()
}

boot()
