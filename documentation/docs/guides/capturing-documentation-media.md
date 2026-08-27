---
sidebar_position: 20
---

# Capturing screenshots and video for the docs

Anything with a visual outcome is documented with a picture of it, not a description. This is how
to produce one from the running app, so the picture is the real thing rather than a mock-up.

:::note Source files
`.claude/rules/docs.md`, `.claude/skills/verify/SKILL.md`, `documentation/static/`
:::

## Before anything, run the app on a known port

```bash
pnpm dev --port 5317 --strictPort
```

`--strictPort` matters: without it Vite silently picks another port when 5317 is taken, and the
capture script then photographs whatever else is running.

Routes come from the view tree as `/<dir-lowercase>/<ViewBaseName>` — `/games/TiltMaze`,
`/tests/CameraShowcase`.

## A screenshot

Playwright is already a dev dependency. Write the script **outside** the repository and import
Playwright by absolute path, so nothing is left behind:

```js
import { chromium } from '<repo>/node_modules/playwright/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 520 } })

await page.goto('http://localhost:5317/games/TiltMaze')
await page.waitForTimeout(8000)

// Panels cover the scene; close them unless they are the subject.
await page.evaluate(() => document.querySelector('[aria-label="Close all panels"]')?.click())
await page.waitForTimeout(400)

await page.screenshot({ path: '/tmp/shot.png' })
await browser.close()
```

A 3D view needs roughly eight seconds before models and textures have loaded. Screenshotting
earlier photographs a half-built scene, which is the most common way these end up wrong.

Clip the shot to the canvas rather than taking the whole page. It drops the page band above the
canvas while keeping the DOM overlays that sit inside that rectangle, so the HUD still appears:

```js
const clip = await page.locator('canvas').first().boundingBox()
await page.screenshot({ path: '/tmp/shot.png', clip })
```

## Four things that will waste a run

Each of these fails silently or times out rather than saying what is wrong.

**The panel toolbar is hidden until the pointer is near the top.** `GlobalNavigation` tracks the
pointer against `NAV_HEIGHT_PX`, so clicking `[aria-label="Debug"]` does nothing at all on a view
whose panels start closed. Move the mouse to the top edge first, wait a beat, then click. The
close-all button appears to work without this only because open panels already keep the bar
visible.

**Most games do not mount a scene until their lobby wizard is started.** A route reporting zero
canvases is usually waiting on that rather than broken. `getByRole('button', { name: 'Start',
exact: true })` is the handle. Pictionary is the exception: it refuses to start below two
players, so a capture has to open a second page on the same room URL first. Wordle and Squares
start solo.

**LobbyUI config rows are native `<select>` elements**, so looking for a button with the option's
label times out. Target the option instead:

```js
await page.locator('select:has(option[value="stickman"])').selectOption('stickman')
```

**The loading overlay never appears on a warm dev cache.** Hold it on screen by delaying the
asset requests, then navigate to a view whose models have not been fetched yet — re-entering one
already loaded in that page re-requests nothing:

```js
await page.route('**/*.{glb,gltf,hdr,fbx}', async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 9000))
  await route.continue()
})
await page.goto('http://localhost:5317/games/MazeGame')
```

## Catching a moment that only happens mid-play

A transition, a hit, a game-over — these cannot be waited for on a timer. Poll for the element
that marks the moment, then shoot:

```js
let caught = false
while (!caught) {
  await page.waitForTimeout(50)
  caught = await page.evaluate(() => Boolean(document.querySelector('.tilt-maze__wipe')))
}
await page.screenshot({ path: '/tmp/moment.png' })
```

**Drive the game the way a player would, not the way a script would.** Holding two directions at
once wedges a ball into a corner and the moment never arrives; cycling through several directions
reaches it in seconds:

```js
const directions = ['ArrowDown', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'ArrowRight']

for (const key of directions) {
  await page.keyboard.down(key)
  await page.waitForTimeout(600)
  await page.keyboard.up(key)
}
```

## Converting for the docs

Screenshots go in as `.webp`, which is roughly a fifth of the PNG for flat-shaded scenes. Use the
`sharp` already installed:

```js
import sharp from 'sharp'

await sharp('/tmp/shot.png')
  .webp({ quality: 82 })
  .toFile('documentation/static/img/<feature>/<name>.webp')
```

Reference it from the document root, not relatively:

```markdown
![What the reader is looking at](/img/tilt-maze/transition-02-covered.webp)
```

## Video, when motion is the point

Record the whole session, then cut out the seconds that matter. Playwright records per browser
context and writes the file when the context closes:

```js
const context = await browser.newContext({
  viewport: { width: 720, height: 520 },
  recordVideo: { dir: '/tmp/recording', size: { width: 720, height: 520 } }
})
const page = await context.newPage()
// … drive the app …
await context.close()
```

Log the elapsed time when the interesting moment starts, so you know where to cut. Then trim and
compress with `ffmpeg`:

```bash
ffmpeg -ss 29.5 -t 6 -i /tmp/recording/*.webm \
  -c:v libvpx-vp9 -crf 40 -b:v 0 -an \
  documentation/static/video/<feature>/<name>.webm
```

`-an` drops the audio track, `-crf 40` keeps a five-second clip near fifty kilobytes. Check the
cut landed by pulling frames out of the result before committing it:

```bash
ffmpeg -ss 4 -i <name>.webm -frames:v 1 /tmp/check.png
```

Embed it with a `<video>` tag, and put a description inside the tag for anyone who cannot play it:

```html
<video controls loop muted playsinline width="720" src="/video/tilt-maze/level-transition.webm">
  A ball falls into a trap, a pink disc opens across the board, a yellow disc opens inside it
  carrying the words LEVEL DOWN, and the cover closes onto a freshly built maze.
</video>
```

## Checking it before committing

```bash
pnpm docs:build
```

The build fails on broken internal links, and copies `static/` into `build/`. If the asset is not
in `documentation/build/img/…` afterwards, the reference is wrong.
