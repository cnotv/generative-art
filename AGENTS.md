# Generative Art — WebGameKit

A pnpm workspace monorepo: a framework-agnostic toolkit for 3D scenes, games and animation
in `packages/@webgamekit/*`, and a Vue 3 playground that uses it in `src/`. Architecture:
`documentation/docs/architecture/monorepo.md`.

This file holds the rules that apply to every change. Rules for one area load from
`.claude/rules/`, procedures from `.claude/skills/` — both indexed below.

## How work starts

Every request opens an issue, a branch and a draft pull request, in that order, before any
code. There is no plan-first step and nothing to wait for: the issue says what and why in a
few lines, and the decisions land in the pull request body as they are made.

1. **The issue.** One that already exists is read, comments included; otherwise it is written
   from the request. If intent, scope or expected behaviour is unclear, ask one focused
   question covering everything missing, wait, and write it from the answer.
2. **The branch**, off main, named `<type>/<issue-number>-<description>`. A fresh branch every
   time, never the current one, never reused.
3. **The draft pull request**, opened at the first commit rather than the last, carrying
   `Closes #<issue-number>` and kept current as the work moves.

`start-issue` covers the first two steps and `open-pr` the third; neither is optional and their
steps are not reorderable. Tests come first, except for an exploratory prototype, which still
owes them before the pull request is marked ready.

## Working agreements

- **Ask before assuming.** If intent, scope or expected behaviour is unclear, ask one focused
  question covering everything missing, and wait. This applies especially to bug reports with
  no reproduction, ambiguous acceptance criteria, and anything solvable several ways with
  different trade-offs.
- **Give an opinion.** When asked what you think, or whether X beats Y, say what you would do
  and why. Never stop at "it depends".
- **Write it once, at the length it earns.** A one-line fix gets one line; a surprising
  constraint gets a paragraph. Prose that repeats the diff or restates something already
  written above is noise that hides what matters. Each kind of writing has one home, below.
- **Every request starts with an issue and a draft pull request** — see "How work starts".
- **Never modify `eslint.config.js`** unless explicitly asked. Fix violations by changing the
  code, not by loosening the rule.
- **Never use `eslint-disable`**, in any form, and never `--no-verify`. If a hook or a rule
  fails, it is usually right.
- **No emoji** anywhere — code, comments, UI text, commit messages, documentation, output —
  unless explicitly requested. Use SVG icons or text.
- **Prefer `debugger` over `console.log`.** When a fix has failed twice and the bug persists,
  add logging at the relevant paths to see the real runtime values before trying again.

## Code

- **TypeScript only.** No plain JavaScript. No `any` — use a specific type, a generic, or
  `unknown` with narrowing. Never `as SomeType` on unvalidated external data.
- **Functional style.** No classes. No `for` / `while` loops — use `map`, `filter`, `reduce`,
  `flatMap`, `Array.from`. Prefer pure functions and `const`; return new values rather than
  mutating. Keep state in closures, tuples or plain objects.
- **Long descriptive names.** `elementCount`, not `count`. `randomGenerator`, not `rng`.
- **Split large functions** into small, single-purpose ones with names that say what they do.
- **Exported types live in a types module** — a `types.ts` or `types/` folder containing only
  type declarations, never alongside logic. A component's own local `interface Props` is exempt.
- **Config files hold data, never logic.** A `config.ts` or `src/config/**` is a flat list of
  literal values: no functions, no `map` building entries, no branching, nothing derived from
  another value. Whatever has to be worked out, the module that uses it works out.
- **Update every call site.** When a signature, type or export changes, `grep` the whole repo
  and fix all consumers in the same change. Never add an overload, a shim or a deprecated
  alias to keep old callers working. Fix it properly rather than layering a workaround.
- **Comments explain why, never what.** If code needs a comment to say what it does, rewrite
  the code. No commented-out debug notes, no "was X, now Y", no section labels.
- **Spell out a domain acronym on first use**, e.g. `ccd` (continuous collision detection).
- **DRY and KISS.** If a pattern appears twice, extract it. Prefer the simplest thing that
  works over an abstraction you might need later.
- **Reuse before writing.** Check `src/components/`, `src/utils/` and `src/stores/` first.
  `src/components/` has five tiers — `ui/` primitives, the `LobbyUI/` overlay kit, the
  `panels/` system, `<Feature>/` folders and shared root components — and `vue-components.md`
  says which to reach for. Verify a dependency is actively maintained before adding it.
- **No pointless wrappers.** Before adding a `<div>` or `<section>`, ask what layout,
  semantics or behaviour it adds that the parent cannot. If none, drop it.

## Git

- Branches are always `<type>/<issue-number>-<description>` (`feat`, `fix`, `docs`,
  `refactor`, `test`, `chore`), so the number is on the branch from its first commit.
- **Rebase, never merge.** `git fetch origin main && git rebase origin/main`. Never `git pull`,
  which merges by default. After a rebase, `git push --force-with-lease`, never `--force`.
- **Commit subjects never reference an issue number** — no `#123`, no `(#123)`, no
  `Closes #123`, in subject or body. The branch name carries it and the PR body carries
  `Closes #<issue-number>`. There is no exception. Write `<type>: <summary>`.

## Where output goes

Documentation is Docusaurus, in `documentation/`. Never create a standalone markdown file
elsewhere in the repo.

Every explanation has one home. Write it there; everywhere else links to it.

| What you have                                    | Where it goes                      |
| ------------------------------------------------ | ---------------------------------- |
| How to use or run something                      | `documentation/docs/guides/`       |
| A package's API                                  | `documentation/docs/packages/`     |
| How the pieces fit, or a structural change       | `documentation/docs/architecture/` |
| A challenge, a wrong turn, or a research finding | `documentation/docs/journey/`      |
| A constraint that will bite the next person here | the matching `.claude/rules/` file |

A PR body links to these homes; a section growing into an explanation belongs in one.

## Definition of done

These are the steps that are easy to omit and impossible to notice missing. Run the
`finish-change` procedure, or walk them by hand:

- [ ] New view has a `src/config/viewsMeta.json` entry
- [ ] New package is in the `packages` array in `vite.config.ts`
- [ ] New `LobbyUI*` component or variant appears in `LobbyUIShowcase.vue`
- [ ] Changed package API is reflected in `documentation/docs/packages/`
- [ ] Any guide that tracks a file you changed has been re-read and fixed
- [ ] A journey doc exists if the work produced a non-obvious finding
- [ ] The issue and the PR opened at the start still describe the work accurately, rather
      than leaving it to be inferred from a thread of comments
- [ ] Every artifact the issue named exists, not just the ones that were forced by a deletion
- [ ] `pnpm lint`, `pnpm lint:css` and `pnpm test:unit` pass, and you saw them pass

## Scoped rules

Each file in `.claude/rules/` declares a `paths:` glob and loads only when a matching file is
touched. Read one directly if you are working in its area without opening a matching file.

| File in `.claude/rules/` | Covers                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| `vue-components.md`      | anything in `src/components/` or `src/views/`, or a stylesheet               |
| `lobby-ui.md`            | the LobbyUI kit, a game overlay or dialog, or anything in `src/views/Games/` |
| `threejs-views.md`       | a 3D view, scene, animation loop, or the threejs package                     |
| `packages.md`            | anything in `packages/`                                                      |
| `tests.md`               | any `*.test.ts`                                                              |
| `docs.md`                | anything in `documentation/`                                                 |
| `colour.md`              | choosing any colour — a material, a background, a token, a diagram           |

## Procedures

Skills in `.claude/skills/<name>/SKILL.md`, as plain markdown any agent can read.

| Skill           | Use when                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| `start-issue`   | a GitHub issue is linked and work is about to begin                                       |
| `verify`        | confirming a change works or looks right in the running app                               |
| `perf-check`    | a 3D scene or asset changed, or something is reported slow                                |
| `journey-doc`   | a finding is worth recording — a repeated fix, a framework quirk, an invisible constraint |
| `sync-docs`     | you changed a file that a tutorial documents                                              |
| `finish-change` | before claiming work is complete                                                          |
| `open-pr`       | the work is validated and ready to ship, or a pull request was explicitly requested       |
