---
sidebar_position: 18
---

# Releasing the packages

Every `@webgamekit/*` package is published to npm from `main`. Nobody edits a version number
by hand, and nothing reaches npm without having been installed and imported first.

:::note Source files
`.changeset/config.json`, `.github/workflows/publish.yml`, `.github/workflows/test.yml`,
`scripts/verify-packages.mjs`
:::

## Writing a changeset

A change that alters what a consumer of a package sees needs a changeset. Run it before
opening the pull request:

```bash
pnpm changeset
```

It asks which packages changed and whether the change is a patch, a minor or a major, then
writes a small markdown file under `.changeset/`. Commit that file with the rest of the work.

Write a changeset when the change touches a package's behaviour, its API, its types or its
dependencies. Skip it for work that never leaves `src/`, for documentation, and for tests —
a consumer cannot observe any of those.

The summary you type becomes the changelog entry, so write it for someone who has never seen
this repository and is deciding whether to upgrade.

## One version for the whole scope

The scope is versioned as a block. `fixed: [["@webgamekit/*"]]` in `.changeset/config.json`
means a patch to one package bumps every package to the same new version, and they are
published together.

This trades precision for a property worth more here: any two `@webgamekit` packages carrying
the same version number are known to have been built and tested together. Independent
versions across fourteen packages produce a peer-dependency matrix that costs more to reason
about than the extra precision returns.

The cost is real and worth stating: a package with no changes still gets a new version, so a
consumer who reads the changelog will find entries that do not concern them.

## What happens on merge

Merging to `main` does not publish. It runs `.github/workflows/publish.yml`, which behaves
differently depending on whether changesets are pending:

- **Changesets are pending** — the workflow opens or updates a pull request titled
  `chore: version packages`. That pull request applies the version bumps and writes the
  changelogs. Nothing is published yet.
- **No changesets are pending**, which is the state right after that pull request merges —
  the workflow publishes every package to npm, tags the release and creates the GitHub
  release.

So a release is two merges: the work, then the version pull request. Reviewing the second one
is the last chance to read the changelog as a consumer will read it.

## The gate before npm

Both the pull request workflow and the release workflow run:

```bash
pnpm run verify:packages
```

It builds every package, then packs each one into a tarball, installs those tarballs into a
throwaway project outside this workspace, and imports them the way a stranger would — the ESM
entry, the CommonJS entry, and a TypeScript compile against the published types.

This exists because nothing else here would notice a broken build. The app resolves
`@webgamekit/*` through Vite aliases straight to `packages/*/src/index.ts`, so the playground
and the entire test suite run against source and never load a single built file. A package
could fail to build, omit an export, or point `types` at a file `tsc` never emitted, and every
check would still pass.

Run it locally before a release if you want the same answer CI will give:

```bash
pnpm run verify:packages
```

A failure names the package and the entry point that did not resolve. The first run of this
check found a package that could not be imported outside a browser at all;
[Publishing Blind](../journey/publishing-blind.md) is the account of what it was hiding.

## Things that will bite

**Module scope runs in Node.** The verification imports each package in plain Node, with no
DOM. A package that reads `window`, `document` or `localStorage` while its module is being
evaluated fails there — and would equally fail for any consumer rendering on a server. Read
browser globals inside the function that needs them, not at the top level of a module.

**`files` decides what ships.** Each manifest publishes only `dist`. A package that starts
depending on a file outside `dist` at runtime will pass every local check and fail once
installed.
