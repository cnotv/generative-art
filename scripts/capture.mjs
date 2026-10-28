/**
 * Screenshots routes of the running app. One tool for every picture of the app: the per-page
 * Open Graph images in public/og/, docs images and pull request screenshots.
 *
 * Usage:
 *   node scripts/capture.mjs <route...>                 OG image for each route, 1200x630
 *   node scripts/capture.mjs --all                      OG image for every route
 *   node scripts/capture.mjs <route> --out <file>       one shot; .webp, .jpg or .png by extension
 *
 * Options: --base <url> (default http://localhost:5317), --size <width>x<height>,
 * --wait <ms> before the shot (3D views need about eight seconds to load).
 * See documentation/docs/guides/capturing-documentation-media.md.
 */
import { mkdirSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'
import { ROOT, discoverRoutes, ogImage } from './routes.mjs'

const OPTIONS_WITH_VALUE = ['--out', '--base', '--size', '--wait']
const SETTLE_MS = 400

export const parseArguments = (argv) =>
  argv.reduce(
    (parsed, argument, index, all) => {
      const value = all[index + 1]
      if (argument === '--all') return { ...parsed, all: true }
      if (argument === '--out') return { ...parsed, out: resolve(value) }
      if (argument === '--base') return { ...parsed, base: value }
      if (argument === '--wait') return { ...parsed, wait: Number(value) }
      if (argument === '--size') {
        const [width, height] = value.split('x').map(Number)
        return { ...parsed, width, height }
      }
      if (OPTIONS_WITH_VALUE.includes(all[index - 1])) return parsed
      return { ...parsed, routes: [...parsed.routes, argument] }
    },
    {
      routes: [],
      all: false,
      out: '',
      base: 'http://localhost:5317',
      width: 1200,
      height: 630,
      wait: 8000
    }
  )

export const outputFor = (route, out) => out || join(ROOT, 'public', ogImage(route))

const ENCODERS = {
  '.webp': (image) => image.webp({ quality: 82 }),
  '.jpg': (image) => image.jpeg({ quality: 80, mozjpeg: true }),
  '.png': (image) => image.png()
}

const clickIfPresent = (page, selector) =>
  page.evaluate((target) => document.querySelector(target)?.click(), selector)

const capture = async (browser, { route, file, base, width, height, wait }) => {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(`${base}${route}`, { waitUntil: 'load' })
  await page.waitForTimeout(wait)

  // Most games mount their scene only once the lobby wizard is started
  const start = page.getByRole('button', { name: 'Start', exact: true })
  if (await start.isVisible().catch(() => false)) {
    await start.evaluate((element) => element.click())
    await page.waitForTimeout(wait)
  }

  // Panels cover the scene; close them so the view itself is the subject
  await clickIfPresent(page, '[aria-label="Close all panels"]')
  await page.waitForTimeout(SETTLE_MS)

  const shot = await page.screenshot()
  await page.close()

  mkdirSync(dirname(file), { recursive: true })
  const encode = ENCODERS[extname(file)] ?? ENCODERS['.png']
  await encode(sharp(shot)).toFile(file)
}

const main = async () => {
  const options = parseArguments(process.argv.slice(2))
  const routes = options.all ? discoverRoutes().map(({ path }) => path) : options.routes
  if (routes.length === 0) {
    console.error('Usage: node scripts/capture.mjs <route...> | --all [--out <file>]')
    process.exit(1)
  }

  // WebGL in headless Chromium runs on SwiftShader, which recent versions only allow when asked
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  // One route at a time: parallel WebGL pages starve each other and capture half-loaded scenes
  await routes.reduce(async (previous, route) => {
    await previous
    const file = outputFor(route, options.out)
    await capture(browser, { ...options, route, file })
    console.log(`  ✓ ${route} -> ${file}`)
  }, Promise.resolve())
  await browser.close()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
