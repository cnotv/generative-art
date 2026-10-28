---
sidebar_position: 17
---

# SEO: OG Meta Tags and Static Pre-rendering

## Goal

Make every view share a meaningful title, description, and preview image when pasted into Slack, Discord, Twitter, or any Open Graph-aware platform.

---

## Why dynamic JS meta tags aren't enough

The first attempt used `router.beforeEach` to update `og:title`, `og:description`, and the rest via `document.querySelector` on every navigation. That works for users navigating inside the app — the tab title and in-document tags update correctly — but social media crawlers don't execute JavaScript. They fetch the raw HTML, read the `<head>` once, and move on. So every URL shared would show the same generic default.

The fix is to pre-render a static `index.html` for each route with the correct tags already baked in, served directly by the file server before any JS runs.

---

## Architecture

```
pnpm build
  └── vue-tsc --noEmit          # type-check
  └── vite build                # bundle the SPA into dist/
  └── node scripts/generate-route-html.mjs    # inject meta tags into per-route HTML files
```

The images are not made during the build. `pnpm capture` takes them from a running app and they are committed to `public/og/`, which Vite copies into `dist/`.

---

## Route discovery

The build and capture scripts share a route discovery module at `scripts/routes.mjs`. It scans `src/views/{Group}/` with the same logic as the Vite-based router config (`src/config/router.ts`), but runs in plain Node.js with no Vite or TS dependencies. Each entry returns `{ path, name, group, viewName }`.

---

## Static HTML generation

`scripts/generate-route-html.mjs` reads `dist/index.html` and, for each route, replaces the meta tag `content` attributes with route-specific values using regex, then writes the result twice: to `dist/{path}/index.html` and to `dist/{path}.html`.

```
dist/
  index.html                          ← default (app shell)
  experiments/
    MaterialsList/
      index.html                      ← og:title = "Materials List | Generative Art"
    MaterialsList.html                ← same file, for URLs without a trailing slash
    EarthGazer/
      index.html
  games/
    MazeGame/
      index.html
  ...
```

Netlify serves `{path}/index.html` for `/{path}` with or without the trailing slash. Production on cnotv.xyz runs `vite preview` in Docker, which does not: for `/{path}` it only looks for `{path}.html` and otherwise falls back to the root `index.html`, so every shared link (they never end in `/`) got the default tags. Writing the sibling `{path}.html` covers both servers. Client-side navigation still uses the main bundle — only the initial HTML differs.

**Image resolution order:**

1. Explicit `image` field in `viewsMeta.json`
2. The route's capture at `public/og/{group}/{viewName}.jpg`, the route path plus `.jpg`
3. The landing page's capture, `/og/experiments/LandingPage.jpg`

The same landing capture is the root `index.html` default and the docs site's social card, so one picture represents the site everywhere it is shared.

---

## Committed captures, not build-time screenshots

A first version took the screenshots during `pnpm build`: a Playwright script served `dist/`, opened each route at 1200 x 630 and wrote `dist/previews/`. It was reverted. Netlify could not install Playwright's system dependencies without root, the Alpine Docker build had no browser at all, and three seconds of waiting photographed many 3D views half loaded. Its fallback was `/logobw.svg`, which Facebook, X and LinkedIn do not render as a preview, so most shares had no picture.

The images are now taken once with `scripts/capture.mjs` against a dev server and committed. That script is also how docs and pull request screenshots are made (see [Capturing screenshots and video for the docs](../guides/capturing-documentation-media.md)), so every picture of the app comes from the same place. It waits eight seconds, presses the lobby's **Start** button when there is one, and launches Chromium with `--enable-unsafe-swiftshader`, without which recent headless Chromium refuses the software WebGL the scenes need. A unit test fails for any discovered route without its capture, so a new view cannot ship with a missing image.

---

## Per-view metadata

`src/config/viewsMeta.json` is the single source of truth for descriptions and optional custom images. Both the TypeScript app (`src/config/viewsMeta.ts`) and the Node.js build scripts read this JSON directly, so there is no duplication and no Vite/TS dependency in the scripts.

To customise a view:

```json
{
  "Materials List": {
    "description": "Interactive showcase of all Three.js PBR material types with live property controls.",
    "image": "/og/custom/materials-list.png"
  }
}
```

---

## Key lessons

- **Crawlers don't run JS.** Dynamic meta tag updates via `router.beforeEach` are invisible to link-unfurl bots. Static HTML per route is the only reliable solution without SSR.
- **Keep the browser out of the build.** Screenshots at build time tied every host to Playwright. Committed captures keep the build plain Node and the images reviewable in the pull request that changes them.
- **SVG is not a share image.** Open Graph consumers want JPEG or PNG; the old logo fallback showed nothing.
- **Route discovery duplication.** The router uses `import.meta.glob` which is Vite-specific. The build scripts need the same logic in plain Node.js. The shared `scripts/routes.mjs` module avoids repeating the logic in every script while staying dependency-free.
- **The name derivation itself still has to be duplicated, by hand.** `scripts/routes.mjs` shares route _discovery_ with the build scripts, but the route _name_ it produces still has to match `deriveRouteName` in `src/config/router.ts` letter for letter, because both are used as the lookup key into the same `viewsMeta.json`. There is no Node.js TypeScript runner available (no `ts-node`/`tsx`, and the Node version in use predates built-in type stripping), so the two functions can't import one shared module without adding a dependency. When one side changed and the other didn't, `viewsMeta.json` entries silently stopped resolving on the side that fell behind — the client-side title looked right while the build-time OG/Twitter tags fell back to the generic description, or the other way around. `src/tests/routeNames.test.ts` now asserts the two derivations produce identical output for every discovered view, so a future edit to either regex fails loudly instead of drifting.
