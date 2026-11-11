// Generates the admin app icons in public/icons. Re-run after the brand look is decided:
//   npx tsx scripts/make-icons.ts
import fs from 'node:fs'
import sharp from 'sharp'

const MAROON = '#7a1f2b'
const GOLD = '#c9a646'

/** A shopping bag with a gold handle; `inset` keeps it inside the maskable safe zone. */
function svg(size: number, inset: number): Buffer {
  const s = size
  const pad = s * inset
  const w = s - pad * 2
  const bagTop = pad + w * 0.32
  const bagBottom = pad + w * 0.95
  const left = pad + w * 0.16
  const right = pad + w * 0.84
  const handleW = w * 0.34
  const cx = s / 2
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    <rect width="${s}" height="${s}" fill="${MAROON}"/>
    <path d="M ${cx - handleW / 2} ${bagTop} V ${pad + w * 0.22} A ${handleW / 2} ${handleW / 2} 0 0 1 ${cx + handleW / 2} ${pad + w * 0.22} V ${bagTop}"
      fill="none" stroke="${GOLD}" stroke-width="${w * 0.06}" stroke-linecap="round"/>
    <path d="M ${left} ${bagTop} H ${right} L ${right - w * 0.04} ${bagBottom} H ${left + w * 0.04} Z" fill="#ffffff"/>
    <rect x="${left}" y="${bagTop + w * 0.12}" width="${right - left}" height="${w * 0.05}" fill="${GOLD}"/>
  </svg>`)
}

async function main() {
  fs.mkdirSync('public/icons', { recursive: true })
  await sharp(svg(192, 0.06)).png().toFile('public/icons/icon-192.png')
  await sharp(svg(512, 0.06)).png().toFile('public/icons/icon-512.png')
  await sharp(svg(512, 0.2)).png().toFile('public/icons/icon-maskable-512.png')
  console.log('Icons written to public/icons')
}

main()
