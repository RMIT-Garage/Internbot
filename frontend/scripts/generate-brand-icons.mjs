/**
 * Renders public/brand/icon.svg into PNG/ICO assets for the app and favicon.
 * Run: pnpm generate:icons
 */
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = join(__dirname, '..')
const svgPath = join(frontendRoot, 'public', 'brand', 'icon.svg')
const brandDir = join(frontendRoot, 'public', 'brand')
const appDir = join(frontendRoot, 'src', 'app')

const svg = await readFile(svgPath)

async function writePng(buffer, width, height, outPath) {
  await mkdir(dirname(outPath), { recursive: true })
  await sharp(buffer).resize(width, height).png().toFile(outPath)
  console.log(`wrote ${outPath}`)
}

const raster = await sharp(svg).png().toBuffer()

await writePng(raster, 512, 512, join(brandDir, 'icon.png'))
await writePng(raster, 32, 32, join(brandDir, 'icon-32.png'))
await writePng(raster, 180, 180, join(brandDir, 'icon-180.png'))

await writePng(raster, 32, 32, join(appDir, 'icon.png'))
await writePng(raster, 180, 180, join(appDir, 'apple-icon.png'))

try {
  await sharp(svg).resize(32, 32).toFormat('ico').toFile(join(appDir, 'favicon.ico'))
} catch {
  await sharp(svg).resize(32, 32).png().toFile(join(appDir, 'favicon.ico'))
}
console.log(`wrote ${join(appDir, 'favicon.ico')}`)
