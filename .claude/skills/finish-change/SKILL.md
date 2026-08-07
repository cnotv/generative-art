---
name: finish-change
description: >-
  Use before claiming work is complete, done, finished, ready or working, and before
  committing or opening a pull request — "is this done", "wrap it up", "finish this off",
  "ready to commit". Runs the checks and the registration sweep that are easy to omit and
  hard to notice missing: viewsMeta entries, vite.config package registration, the LobbyUI
  showcase, docs that went stale, and the full lint and test suite.
---

# Finishing a change

The point of this sweep is the things nobody notices are missing. A forgotten lint fix
surfaces in seconds; a forgotten showcase row surfaces in months, if ever.

## Run the checks

```sh
pnpm lint
pnpm lint:css
pnpm test:unit
```

Read the output. "It should pass" is not evidence — if you did not see it pass, it did not
pass. If any of these fail, the work is not finished, and reporting it as finished with a
note about the failure is still reporting it wrong.

## Sweep the registrations

Each of these is invisible when missing, which is why it gets its own line:

- **New view** — is there a `src/config/viewsMeta.json` entry, keyed by the route name the
  router generates (capital letters become spaced words)? Without it the view falls back to
  the generic site description when shared.
- **New package** — is it in the `packages` array in `vite.config.ts`? If not, Vite resolves
  it through `node_modules` to a possibly stale `dist`, and the app throws a runtime
  `SyntaxError` in both dev and Docker.
- **New LobbyUI component or variant** — does it appear in
  `src/views/Tests/LobbyUIShowcase/LobbyUIShowcase.vue`, wired into a labelled row with
  realistic data? A component that is not in the showcase is an incomplete change.
- **Changed package API** — is `documentation/docs/packages/` updated with the new exports?
- **Changed a file a tutorial tracks** — run the `sync-docs` procedure.
- **Non-obvious finding along the way** — run the `journey-doc` procedure.
- **Touched a 3D scene or asset** — run the `perf-check` procedure.

## Definition of done

Every command above was run and its output seen, and every applicable line of the sweep is
either done or explicitly not applicable. State what was verified and how; if something was
skipped, say which and why rather than leaving it implied.
