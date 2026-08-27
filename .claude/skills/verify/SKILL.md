---
name: verify
description: >-
  Use when asked to check, confirm, test, look at, screenshot, or verify that a change
  actually works or looks right in the running app or browser — "does this work", "does it
  look right", "show me", "take a screenshot", "run the app". Also use whenever a change
  affects 3D positioning, lighting, shadows, camera, animation, physics or layout, where
  unit tests and type checking cannot confirm the outcome. Covers launching the dev server,
  the route naming convention, and driving the Three.js canvas with Playwright.
---

# Verifying a change in the running app

Reading coordinates and doing the arithmetic in your head is not a substitute for looking
at the scene. If a change has a visual outcome, look at it.

## Launch

```sh
pnpm dev --port 5317 --strictPort
```

The fixed port matters: plain `pnpm dev` picks the first free port and collides with other
Vite apps on the same machine, so a hardcoded URL in a script silently points at the wrong
app. `--strictPort` makes that failure loud instead of silent.

Routes come from the view file tree, as `/<dir-lowercase>/<ViewBaseName>`:

| File                                            | Route                           |
| ----------------------------------------------- | ------------------------------- |
| `src/views/Experiments/ComplexAnimation.vue`    | `/experiments/ComplexAnimation` |
| `src/views/Tools/GrassGenerator.vue`            | `/tools/GrassGenerator`         |
| `src/views/Games/GoombaRunner/GoombaRunner.vue` | `/games/GoombaRunner`           |

## Drive it

Playwright is a repo dev dependency. Write the script **outside** the repo and import
Playwright by absolute path, so no stray files are left behind:

```js
import { chromium } from '<repo>/node_modules/playwright/index.mjs'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
await page.goto('http://localhost:5317/games/GoombaRunner')
await page.waitForTimeout(9000)
await page.screenshot({ path: '/tmp/scene.png' })
await browser.close()
```

Write screenshots to a temporary directory, never into the repo. Then read the PNG — most
agent tools render images inline, so it can be inspected like any other file.

## Gotchas

- The Three.js canvas covers the viewport and intercepts pointer events, so `locator.click()`
  times out on nav and panel buttons. Use a programmatic click: `locator.evaluate((el) => el.click())`.
- Panel toggles are icon buttons identified by `aria-label`: `Navigation`, `Elements`,
  `Config`, `Debug`, `Timeline`, `Close all panels`.
- To reach the camera panel: click the `Elements` toggle, then the row with exact text `Camera`.
- Views with async FBX or GLTF loads need roughly 9 seconds before the scene is ready.
- **Restart the dev server after any git operation that rewrites files** — `stash`, `stash pop`,
  `checkout`, `rebase`. Vite keeps serving the transform it already has, so the browser runs code
  that is not on disk and the screenshot disproves a change that is actually correct. Comparing
  against a baseline by stashing is exactly when this bites.
- The console shows recurring `HTTP 400 https://gateway.umami.is/api/send`. That is external
  analytics, not an app error.

## Faking a phone

A view driven by the camera, the location or the tilt sensor looks unverifiable on a desktop.
It is not: Chromium will fake all three, so "you need a phone for this" is almost never true.

```js
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
})
const context = await browser.newContext({
  viewport: { width: 420, height: 860 },
  permissions: ['camera', 'geolocation'],
  geolocation: { latitude: 52.3731, longitude: 4.8922 },
  isMobile: true,
  hasTouch: true
})
```

The fake camera is a green rotating pattern rather than a street, which is what makes an
overlay legible in a screenshot: the real output stands in front of a stand-in world.

Orientation has no Playwright API, so dispatch the event the page already listens for. Fire it
many times in one `evaluate`, or per-frame smoothing will still be easing toward the pose when
the screenshot is taken:

```js
await page.evaluate(() => {
  Array.from({ length: 90 }).forEach(() => {
    const event = new Event('deviceorientation')
    Object.assign(event, { alpha: 270, beta: 90, gamma: 0 })
    window.dispatchEvent(event)
  })
})
```

Two poses are worth knowing, because they are the ones that catch sign errors: upright facing
north is `alpha 0, beta 90, gamma 0`, and rolled a quarter turn clockwise into landscape while
still facing north is `alpha 270, beta 0, gamma 90`.

Assert the transform, not just the picture — `getComputedStyle(el).transform` on an overlay
layer gives a matrix whose rotation can be read off directly, which pins a sign a screenshot
only suggests.

## Choosing an angle

Orbit controls respond to mouse drag on the canvas, so a second angle is cheap and often
decisive:

```js
const box = await (await page.$('canvas')).boundingBox()
const cx = box.x + box.width / 2
const cy = box.y + box.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx - 50, cy + 200, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(1000)
```

- The **default angle** shows left/right and front/back placement, and whether one object
  visually sinks into another.
- A **top-down angle** (drag down) confirms X/Z alignment — whether something is centred
  over what it stands on.
- **Shadows read as height.** The gap between an object and its shadow says how far above
  the ground it sits, and a missing shadow usually means `castShadow` was never passed to
  `getModel` or `getCube`.
- For animation or physics, take several shots with waits between them. One frame cannot
  distinguish falling from floating from oscillating.

## Definition of done

You have looked at the result and it shows what you claimed. If the screenshot is unchanged
after a fix, the assumption behind the fix is probably wrong — go back to the underlying
values (collider size, position formula, light or shadow camera bounds) rather than
screenshotting the same change again.

Stop the dev server if you started it for this: `pkill -f vite`.
