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

## Registration

A new package must be added to the `packages` array in `vite.config.ts`. Without it Vite
resolves the import through `node_modules` to the built `dist`, and a stale or incomplete
build throws a runtime `SyntaxError` in both dev and Docker.
