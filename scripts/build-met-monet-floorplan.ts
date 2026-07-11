/**
 * One-off generator: floorplan JSON for Met Open Access Monet set (OldArtworks/).
 * Run: bun scripts/build-met-monet-floorplan.ts
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.join(import.meta.dir, '..')
const OLD = path.join(ROOT, 'public/img/OldArtworks')
const OUT = path.join(ROOT, 'public/galleries/met-monet.json')

type MetJson = {
  Title?: string
  Artist?: string
  Date?: string
}

function parseArtist(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/^([^(]+)/)
  return m?.[1]?.trim()
}

function parseYear(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.match(/\d{4}/)
  return m?.[0]
}

const indices = fs
  .readdirSync(OLD)
  .filter((f) => f.endsWith('.json'))
  .map((f) => Number.parseInt(f.replace('.json', ''), 10))
  .filter((n) => !Number.isNaN(n))
  .sort((a, b) => a - b)

const photoCatalog = indices.map((i) => {
  const meta = JSON.parse(fs.readFileSync(path.join(OLD, `${i}.json`), 'utf8')) as MetJson
  return {
    id: `photo-${i}`,
    title: meta.Title || `Painting ${i + 1}`,
    src: `/img/OldArtworks/${i}.jpg`,
    ...(parseArtist(meta.Artist) ? { artist: parseArtist(meta.Artist) } : {}),
    ...(parseYear(meta.Date) ? { year: parseYear(meta.Date) } : {}),
  }
})

/** U-shaped 5×5 — same footprint as Parallel Horizons demo. */
const activeCells = [
  '4,1', '3,0', '4,0', '0,3', '4,2', '4,3', '4,4', '2,4', '3,4', '1,4', '0,4', '0,2', '0,1', '0,0', '1,0', '2,0',
]

const active = new Set(activeCells)
type Wall = 'north' | 'east' | 'south' | 'west'

function exteriorWalls(key: string): Wall[] {
  const [r, c] = key.split(',').map(Number)
  const walls: Wall[] = []
  if (!active.has(`${r - 1},${c}`)) walls.push('north')
  if (!active.has(`${r},${c + 1}`)) walls.push('east')
  if (!active.has(`${r + 1},${c}`)) walls.push('south')
  if (!active.has(`${r},${c - 1}`)) walls.push('west')
  return walls
}

const slots: { key: string; wall: Wall }[] = []
for (const key of activeCells) {
  for (const wall of exteriorWalls(key)) slots.push({ key, wall })
}

const placements: Record<string, Record<Wall, string | string[]>> = {}
for (const key of activeCells) {
  placements[key] = { north: '', east: '', south: '', west: '' }
}

let photoIdx = 0
for (const slot of slots) {
  if (photoIdx >= photoCatalog.length) break
  const id = photoCatalog[photoIdx]!.id
  const cell = placements[slot.key]!
  const existing = cell[slot.wall]
  if (!existing) {
    cell[slot.wall] = id
    photoIdx++
  } else if (typeof existing === 'string' && existing) {
    cell[slot.wall] = [existing, id]
    photoIdx++
  } else if (Array.isArray(existing)) {
    existing.push(id)
    photoIdx++
  }
}

const floorplan = {
  version: 2 as const,
  title: 'Monet at the Met',
  slug: 'met-monet',
  grid: { rows: 5, cols: 5 },
  activeCells,
  placements,
  photoCatalog,
  spawn: { cell: '4,0', y: 1.75 },
  wallStyle: 'linen' as const,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(floorplan, null, 2)}\n`, 'utf8')
console.log(`Wrote ${OUT} — ${photoIdx} of ${photoCatalog.length} paintings placed on ${slots.length} wall slots.`)

