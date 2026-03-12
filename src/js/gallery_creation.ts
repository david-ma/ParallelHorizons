declare const d3: any

type CellKey = string

type PhotoItem = {
  id: string
  title: string
  src: string
}

type FloorplanData = {
  version: 1
  grid: { rows: number; cols: number }
  activeCells: CellKey[]
  placements: Record<CellKey, string>
  photoCatalog: PhotoItem[]
}

const GRID_ROWS = 5
const GRID_COLS = 5
const CELL_SIZE = 120
const CELL_GAP = 14
const PADDING = 18

const photoCatalog: PhotoItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `photo-${i}`,
  title: `Photo ${i + 1}`,
  src: `/img/Artworks/${i}.jpg`,
}))

const activeCells = new Set<CellKey>()
const placements: Record<CellKey, string> = {}

function cellKey(row: number, col: number): CellKey {
  return `${row},${col}`
}

function toData(): FloorplanData {
  return {
    version: 1,
    grid: { rows: GRID_ROWS, cols: GRID_COLS },
    activeCells: Array.from(activeCells),
    placements: { ...placements },
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
    const tile = document.createElement('div')
    tile.className = 'photo-tile'
    tile.draggable = true
    tile.dataset.photoId = photo.id
    tile.innerHTML = `<img src="${photo.src}" alt="${photo.title}"><p class="photo-title">${photo.title}</p>`
    tile.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('text/plain', photo.id)
      event.dataTransfer!.effectAllowed = 'move'
    })
    list.appendChild(tile)
  })
}

function applyData(data: FloorplanData): void {
  activeCells.clear()
  Object.keys(placements).forEach((k) => delete placements[k])

  ;(data.activeCells || []).forEach((k) => activeCells.add(k))
  Object.entries(data.placements || {}).forEach(([k, photoId]) => {
    if (activeCells.has(k)) placements[k] = photoId
  })

  drawGrid()
  updatePreview()
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
      }
      drawGrid()
      updatePreview()
    })
    .on('dragover', (event: DragEvent, d: { key: CellKey }) => {
      if (!activeCells.has(d.key)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = 'move'
    })
    .on('drop', (event: DragEvent, d: { key: CellKey }) => {
      if (!activeCells.has(d.key)) return
      event.preventDefault()
      const photoId = event.dataTransfer?.getData('text/plain')
      if (!photoId) return

      Object.keys(placements).forEach((k) => {
        if (placements[k] === photoId) delete placements[k]
      })
      placements[d.key] = photoId
      drawGrid()
      updatePreview()
    })

  group
    .append('text')
    .attr('class', 'cell-label')
    .attr('x', (d: { x: number }) => d.x + 8)
    .attr('y', (d: { y: number }) => d.y + 16)
    .text((d: { row: number; col: number }) => `${d.row},${d.col}`)

  group
    .append('text')
    .attr('class', 'placed')
    .attr('x', (d: { x: number }) => d.x + 8)
    .attr('y', (d: { y: number }) => d.y + 36)
    .text((d: { key: CellKey }) => {
      const photoId = placements[d.key]
      if (!photoId) return ''
      const item = photoCatalog.find((p) => p.id === photoId)
      return item ? item.title : photoId
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
