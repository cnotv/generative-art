---
paths:
  - 'packages/**'
---

# @webgamekit packages

These are a framework-agnostic toolkit, published and consumed independently of this app.

- **No Vue, no React, no framework dependency.** Anything that needs Vue reactivity, router
  or lifecycle belongs in `src/composables/` instead.
- **Every exported function has a JSDoc comment** with `@param` and `@returns`. One line of
  description is enough. `eslint-plugin-jsdoc` enforces this.
- **Exports are prefixed with the package name** so consumers cannot collide:
  `recordCreate` / `recordStart` in `recording`, `animateTimeline` in `animation`,
  `controlsCreate` / `controlsDestroy` in `controls`.
- **`index.ts` is the public API.** Barrel-export from it, and re-export the types a consumer
  needs so they are importable from the package root.
- **Types live in `types.ts`**, never exported from a file that also holds logic. Core
  implementation goes in `core.ts`.

## Changing an API

When a signature, type or export changes, find every usage across the whole repo and update
it in the same change:

```sh
grep -rn "<oldName>" src packages documentation
```

Never add an overload, a shim or a deprecated alias to keep old callers working. No
backward-compatibility layers, no legacy signatures — fix the consumers instead. If the
change alters a package's public API, update `documentation/docs/packages/` in the same
change; a PR that moves an API without its doc is not ready.

## The package build type-checks harder than the app

`pnpm type-check` runs `vue-tsc` with the app's config, which is not the config a package is
built under. Each package has its own stricter `tsconfig.json`, and the build runs as a
`prepare` script — so a type error there surfaces during `pnpm install` in CI and fails every
job at once, long after lint and tests passed locally.

Run `pnpm -r run build` before pushing a change to `packages/`. Assigning `undefined` to a
non-optional field is the usual way to trip it.

## Registration

A new package must be added to the `packages` array in `vite.config.ts`. Without it Vite
resolves the import through `node_modules` to the built `dist`, and a stale or incomplete
build throws a runtime `SyntaxError` in both dev and Docker.

`src/tests/vitePackages.test.ts` and `src/tests/packageDocumentation.test.ts` enforce both
halves of this: every package that exposes source is registered, and every one has a page in
`documentation/docs/packages/`.

## Nothing here loads what you publish

Because of those aliases, the app and the entire test suite import package **source**. No test
ever loads a built file, so a package can fail to build, drop an export, or point `types` at a
file `tsc` never emitted while every check stays green.

- **Never touch `window`, `document` or `localStorage` at module scope.** Read browser globals
  inside the function that needs them. A module-scope read throws on import in Node and in any
  server-rendering context, before a consumer can call anything — and nothing in this repo will
  notice, because the playground always has a browser.
- **Run `pnpm run verify:packages`** after changing a package's build, exports or manifest. It
  builds, packs, installs the tarballs outside the workspace and imports them as a consumer
  would. CI runs it on every pull request and again before publishing.
- **Adding a runtime file outside `dist`** will pass locally and fail once installed; each
  manifest publishes `dist` only.

Background: `documentation/docs/journey/publishing-blind.md`. Release flow:
`documentation/docs/guides/releasing-packages.md`.
