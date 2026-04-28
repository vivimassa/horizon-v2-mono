/**
 * Convert SkyHub logo (blue on white) into a transparent-bg white logo.
 *
 * Strategy:
 *  - Load source PNG.
 *  - For each pixel: compute brightness. Near-white (>240 avg) = fully
 *    transparent. Otherwise force RGB to white #FFFFFF, keep original
 *    alpha proportional to (255 - brightness) so antialiased edges fade
 *    naturally.
 *  - Output PNG with alpha.
 */
import sharp from 'sharp'
import fs from 'node:fs'

const SRC = process.argv[2] ?? 'apps/mobile/assets/skyhub-logo.png'
const OUT = process.argv[3] ?? 'apps/crew/assets/skyhub-logo.png'

const img = sharp(SRC).ensureAlpha()
const meta = await img.metadata()
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })

const channels = info.channels // 4 with ensureAlpha
const out = Buffer.alloc(data.length)

for (let i = 0; i < data.length; i += channels) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const a = channels === 4 ? data[i + 3] : 255

  // Brightness as max channel — preserves antialiased edges of dark blue
  // glyphs better than simple average.
  const bright = Math.max(r, g, b)

  // Near-white background → transparent.
  if (bright >= 240) {
    out[i] = 255
    out[i + 1] = 255
    out[i + 2] = 255
    out[i + 3] = 0
    continue
  }

  // Solid logo pixel (anything notably darker than white) → fully opaque
  // white. Gives a flat silhouette that stands out cleanly on photo bgs.
  out[i] = 255
  out[i + 1] = 255
  out[i + 2] = 255
  if (bright < 215) {
    out[i + 3] = a
  } else {
    // Antialiased edge band: smooth fade from 240 (transparent) to 215 (opaque).
    const t = (240 - bright) / (240 - 215)
    out[i + 3] = Math.round(t * a)
  }
}

await sharp(out, {
  raw: { width: info.width, height: info.height, channels },
})
  .png()
  .toFile(OUT)

const stat = fs.statSync(OUT)
console.log(`Wrote ${OUT}`)
console.log(`  source:   ${SRC} (${meta.width}x${meta.height})`)
console.log(`  output:   ${info.width}x${info.height}, ${stat.size} bytes`)
