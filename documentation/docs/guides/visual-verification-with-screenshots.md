---
sidebar_position: 6
---

# Visual Verification with Screenshots

When a change affects 3D positioning, lighting, shadows, camera, animation or layout, unit
tests and type checking cannot tell you whether it looks right. Reading coordinates and
doing the arithmetic in your head is not a substitute for seeing the scene — so drive the
running app with Playwright and look at the rendered frame.

The procedure itself is agent-base's `verify` skill, which every agent session installs
through the `workflow` plugin. It starts the app the way **Project facts** in `AGENTS.md` says
and reads this page for what is particular to this app. Launching on the fixed port, the route
convention, load waits and the panel toolbar are in
[Capturing screenshots and video for the docs](./capturing-documentation-media.md); this page
adds what matters when the point is checking a change rather than illustrating it.

:::note Source files
`AGENTS.md`, `src/components/GlobalNavigation.vue`
:::

## Reaching the controls

The Three.js canvas covers the viewport and takes pointer events, so `locator.click()` on a nav
or panel button times out. Click programmatically: `locator.evaluate((element) => element.click())`.

Panel toggles are icon buttons named by `aria-label`: `Navigation`, `Elements`, `Config`,
`Debug`, `Timeline` and `Close all panels`. The camera panel is behind `Elements`, then the row
whose exact text is `Camera`.

## Choosing an angle

Orbit controls follow a mouse drag on the canvas, so a second angle costs a few lines and is
often decisive:

```js
const box = await (await page.$('canvas')).boundingBox()
const centerX = box.x + box.width / 2
const centerY = box.y + box.height / 2
await page.mouse.move(centerX, centerY)
await page.mouse.down()
await page.mouse.move(centerX - 50, centerY + 200, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(1000)
```

- The **default angle** shows left/right and front/back placement, and whether one object
  visually sinks into another.
- A **top-down angle** (drag down) confirms X/Z alignment — whether something is centred over
  what it stands on.
- **Shadows read as height.** The gap between an object and its shadow says how far above the
  ground it sits. A missing shadow usually means `castShadow` was never passed to `getModel` or
  `getCube`.

## Noise that is not a bug

The console repeats `HTTP 400 https://gateway.umami.is/api/send` on every view. That is the
external analytics script, not an app error.

## When the screenshot does not change

If a fix does not visibly change the result, the assumption behind the fix is probably wrong.
Go back to the underlying values — collider size, position formula, light or shadow camera
bounds — rather than repeating the same check. And if the last git operation rewrote files
(`stash`, `checkout`, `rebase`), restart the dev server first: Vite keeps serving the transform
it already had.

Stop a dev server started only for the check with `pkill -f vite`.
