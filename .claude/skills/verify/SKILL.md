---
name: verify
description: How to run and drive this app to verify a change end-to-end in the browser
---

# Verifying changes in the running app

## Launch

```sh
pnpm dev --port 5317 --strictPort   # plain `pnpm dev` may collide with other Vite apps on this machine
```

Routes are generated from the view file tree: `/<dir-lowercase>/<ViewBaseName>`,
e.g. `src/views/Experiments/ComplexAnimation.vue` → `/experiments/ComplexAnimation`,
`src/views/Tools/GrassGenerator.vue` → `/tools/GrassGenerator`.

## Drive (Playwright)

Playwright is a repo devDependency. From a script outside the repo, import it by
absolute path: `import { chromium } from '<repo>/node_modules/playwright/index.mjs'`.

Gotchas:

- The Three.js `<canvas>` covers the whole viewport and intercepts pointer events,
  so `locator.click()` times out on nav/panel buttons. Use programmatic clicks:
  `locator.evaluate((el) => el.click())`.
- Panel toggles are icon buttons identified by `aria-label`: `Navigation`,
  `Elements`, `Config`, `Debug`, `Timeline`, `Close all panels`.
- To reach the camera panel: click the `Elements` toggle, then the row with exact
  text `Camera`.
- Views with async model loads (FBX/GLTF) need ~9s before the scene is ready.
- Console shows recurring `HTTP 400 https://gateway.umami.is/api/send` — external
  analytics, not an app error.
