# Generative Art — WebGameKit

A pnpm workspace monorepo: a framework-agnostic toolkit for 3D scenes, games and animation
in `packages/@webgamekit/*`, and a Vue 3 playground that uses it in `src/`. Architecture:
`documentation/docs/architecture/monorepo.md`.

This file holds the rules that apply to every change. Rules that apply to one area load from
`.claude/rules/`, and procedures load from `.claude/skills/` — both indexed at the
bottom.

## How work starts

Two entry paths, chosen by whether an issue exists yet.

- **A linked issue** — the message contains a `github.com/.../issues/N` URL. Read the issue,
  sync main, branch, and post the implementation plan as an issue comment _before_ writing
  any code. Tests come first. Run the `start-issue` procedure; it is not optional and its
  steps are not reorderable.
- **A prototype** — "let's try X", "add an option for Y", with no issue yet. Build the
  proof of concept directly on a branch off main and go straight to something running.
  Validate it together, and only once it is in good shape write the issue documenting what
  was built and why. Never gate this path behind a design doc, spec review or issue-first
  process; the friction is the whole thing it is avoiding. Prototypes are exempt from
  tests-first, but they owe tests before a pull request is opened.

Either way: a fresh branch off main every time. Never commit to the current branch and never
reuse an existing feature branch, however related it looks.

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
- **Never open a pull request unless explicitly asked.**
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
- **Update every call site.** When a signature, type or export changes, `grep` the whole repo
  and fix all consumers in the same change. Never add an overload, a shim or a deprecated
  alias to keep old callers working. Fix it properly rather than layering a workaround.
- **Comments explain why, never what.** If code needs a comment to say what it does, rewrite
  the code. No commented-out debug notes, no "was X, now Y", no section labels.
- **DRY and KISS.** If a pattern appears twice, extract it. Prefer the simplest thing that
  works over an abstraction you might need later.
- **Reuse before writing.** Check `src/components/`, `src/utils/` and `src/stores/` first.
  `src/components/` has five tiers — `ui/` primitives, the `LobbyUI/` overlay kit, the
  `panels/` system, `<Feature>/` folders and shared root components — and `vue-components.md`
  says which to reach for. Verify a dependency is actively maintained before adding it.
- **No pointless wrappers.** Before adding a `<div>` or `<section>`, ask what layout,
  semantics or behaviour it adds that the parent cannot. If none, drop it.

## Git

- Branches are `<type>/<issue-number>-<description>`, with type one of `feat`, `fix`, `docs`,
  `refactor`, `test`, `chore`.
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
- [ ] The linked issue and any open PR still describe the work accurately, edited rather than
      left to be inferred from a thread of comments
- [ ] Every artifact the plan named exists, not just the ones that were forced by a deletion
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
| `open-pr`       | a pull request was explicitly requested                                                   |
