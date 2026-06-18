---
sidebar_position: 6
---

# Visual Verification with Screenshots

When a change affects 3D positioning, lighting, shadows, or any other visual
outcome that can't be confirmed by unit tests or type checking, drive the dev
server with Playwright and inspect the rendered frame directly. This is the
only way to confirm a fix actually looks right — reading coordinates and doing
arithmetic in your head is not a substitute for seeing the scene.

## Prerequisites

- The dev server must be running (`pnpm dev`, default `http://localhost:5173`).
- Playwright is already a project dependency (`node_modules/.bin` has the
  browsers Vitest's browser mode uses), so `import { chromium } from 'playwright'`
  works from a throwaway script without extra installs.

## Taking a screenshot

Write a small script, run it with `node`, then read the resulting PNG. Use
`/tmp` for the output image and a throwaway `.mjs` file inside the repo (so
`node` can resolve the `playwright` package from `node_modules`), removing the
script afterwards:

```js
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto('http://localhost:5173/tests/timeline')

// Give the scene time to load models and run a few simulation frames
await page.waitForTimeout(4000)
await page.screenshot({ path: '/tmp/scene.png' })

await browser.close()
```

```bash
cp script.mjs /Users/.../generative-art/script.mjs && node script.mjs
rm script.mjs
```

The script must run from inside the project directory so the `playwright`
import resolves via `node_modules`, but the output should go to `/tmp` to
avoid leaving stray files in the repo.

## Rotating the camera for a better angle

Orbit controls respond to mouse drag on the canvas. Drag down to look more
top-down (useful for checking X/Z alignment) or drag sideways to check
height/depth relationships:

```js
const canvas = await page.$('canvas')
const box = await canvas.boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2

await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx - 50, cy + 200, { steps: 20 }) // drag down = look from above
await page.mouse.up()
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/scene-top-down.png' })
```

Take screenshots at multiple points in time (`waitForTimeout` between shots)
when verifying animation or physics behavior — a single frame can't show
whether something is falling, floating, or oscillating.

## Inspecting the result

Read the PNG directly — the `Read` tool renders images inline, so the
screenshot can be inspected the same way as any other file:

```
Read /tmp/scene.png
```

When checking positioning:

- **Default angle** confirms relative left/right and front/back placement and
  whether an object visually overlaps another (e.g. a coin sunk into a block).
- **Top-down angle** confirms X/Z alignment — whether an object is centered
  over what it should be standing on.
- **Shadows** are a good proxy for height: an object's shadow position
  relative to the object itself indicates how far above the ground it is, and
  whether shadow-casting is enabled at all (no shadow under a model usually
  means `castShadow` wasn't passed to `getModel`/`getCube`).

If a fix doesn't visibly change the screenshot, the assumption behind the fix
is likely wrong — re-check the underlying values (collider size, position
formula, light/shadow camera bounds) rather than re-screenshotting the same
change repeatedly.

## Cleaning up

Kill the dev server when done if you started it for this purpose:

```bash
pkill -f vite
```
