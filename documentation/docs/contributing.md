---
sidebar_position: 2
---

# Contributing

This page is for working on the toolkit itself. To build something with it, start at
[getting started](./getting-started.md) instead — nothing there needs this repository.

## Setting up

```bash
git clone https://github.com/cnotv/generative-art.git
cd generative-art
pnpm install
```

The repository is a pnpm workspace: the packages live in `packages/*`, a Vue 3 playground that
consumes them lives in `src/`, and standalone starters live in `examples/*`.

## Running things

```bash
pnpm dev          # the playground, on the first free port
pnpm test:unit    # the whole suite, exits when finished
pnpm lint         # eslint, with --fix
pnpm lint:css     # stylelint, with --fix
pnpm build        # type-check, build, and generate the route HTML
```

Use `pnpm test:watch` only while iterating — `pnpm test:unit` is the one that exits.

The documentation site is separate, because it sits outside the workspace:

```bash
pnpm docs:dev
pnpm docs:build
```

## Working on a package

The playground resolves `@webgamekit/*` to package **source** through aliases in
`vite.config.ts`, so a change to a package is live without rebuilding. The cost of that
convenience is that nothing here ever loads a built package, so the published artifact goes
untested by everything else:

```bash
pnpm -r run build        # each package's own stricter type-check and build
pnpm run verify:packages # pack, install outside the workspace, and import as a consumer would
```

Run both before pushing a change under `packages/`. The package `tsconfig.json` is stricter than
the app's, and its build runs as a `prepare` script — so a type error there fails every CI job
during install, long after lint and tests passed locally.

`verify:packages` builds each package, packs it, installs the tarballs into a throwaway project
outside the workspace, and imports them the way a stranger would.

## Working on a template

The starters in `examples/*` are built to be copied out of the repository, so they must not
import from `src/` or rely on anything the published packages do not export.

```bash
pnpm --filter @webgamekit/example-platformer-starter dev
pnpm --filter @webgamekit/example-platformer-starter build
```

CI builds every template, so an API change that breaks one is caught in the same pull request.

## Conventions

The rules that apply to every change are in `AGENTS.md` at the repository root: TypeScript only,
functional style, long descriptive names, tests alongside the implementation, and documentation in
this site rather than loose markdown files. Area-specific rules live in `.claude/rules/` and
procedures in `.claude/skills/`, both readable as plain markdown.

Branches are `<type>/<issue-number>-<description>`, rebased onto `main` rather than merged, and a
commit subject never carries the issue number — the branch and the pull request body do.
