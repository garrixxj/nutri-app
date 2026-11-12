// Generates the provisional app icons (PNG + SVG) without dependencies.
// Design: accent green background with a white calorie ring (3/4 arc, round caps)
// over a faint full track. Run: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const ACCENT = [0x16, 0xa3, 0x4a]
const OUT = new URL('../public/', import.meta.url)

// Ring geometry, relative to icon size. Kept inside the 80% maskable safe zone.
const RING_RADIUS = 0.26
const RING_WIDTH = 0.085
const ARC_START = -Math.PI / 2 // 12 o'clock
const ARC_SWEEP = Math.PI * 1.5 // 270° clockwise

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePng(size, rgb) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Returns white coverage (0..1) at a point in unit space centered on 0. */
function ringAlpha(x, y) {
  const half = RING_WIDTH / 2
  const r = Math.hypot(x, y)
  const onTrack = Math.abs(r - RING_RADIUS) <= half

  // Angle measured clockwise from 12 o'clock, in [0, 2π).
  let a = Math.atan2(y, x) - ARC_START
  a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const inArc = onTrack && a <= ARC_SWEEP

  const capStart = [RING_RADIUS * Math.cos(ARC_START), RING_RADIUS * Math.sin(ARC_START)]
  const end = ARC_START + ARC_SWEEP
  const capEnd = [RING_RADIUS * Math.cos(end), RING_RADIUS * Math.sin(end)]
  const inCap =
    Math.hypot(x - capStart[0], y - capStart[1]) <= half || Math.hypot(x - capEnd[0], y - capEnd[1]) <= half

  if (inArc || inCap) return 1
  if (onTrack) return 0.28
  return 0
}

function render(size) {
  const ss = 4 // supersampling for antialiasing
  const rgb = Buffer.alloc(size * size * 3)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sum = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const x = (px + (sx + 0.5) / ss) / size - 0.5
          const y = (py + (sy + 0.5) / ss) / size - 0.5
          sum += ringAlpha(x, y)
        }
      }
      const alpha = sum / (ss * ss)
      const i = (py * size + px) * 3
      for (let c = 0; c < 3; c++) rgb[i + c] = Math.round(ACCENT[c] * (1 - alpha) + 255 * alpha)
    }
  }
  return encodePng(size, rgb)
}

const files = {
  'apple-touch-icon.png': 180,
  'icon-192.png': 192,
  'icon-512.png': 512,
  'icon-maskable-512.png': 512,
}
for (const [name, size] of Object.entries(files)) writeFileSync(new URL(name, OUT), render(size))

// SVG favicon with the same drawing.
const r = RING_RADIUS * 100
const w = RING_WIDTH * 100
const end = ARC_START + ARC_SWEEP
const ex = 50 + r * Math.cos(end)
const ey = 50 + r * Math.sin(end)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="22" fill="#16A34A"/>
<circle cx="50" cy="50" r="${r}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${w}"/>
<path d="M50 ${50 - r} A${r} ${r} 0 1 1 ${ex.toFixed(2)} ${ey.toFixed(2)}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round"/>
</svg>
`
writeFileSync(new URL('favicon.svg', OUT), svg)
console.log('Icons written to public/')
