# Claude Code Instructions

**Never add rules to this file unless explicitly instructed.**
**Only add strictly Claude Code content to these instructions.**

For project architecture, GitHub workflow, and development patterns, read `.github/copilot-instructions.md`.

## When the user links a GitHub issue

When the user's message contains a `github.com/.*/issues/\d+` URL, execute these steps **in order** before writing a single line of code or documentation:

```sh
STEP 1  gh issue view <number>          -- read the issue
STEP 2  git checkout main
        git fetch origin main
        git rebase origin/main          -- sync local main
STEP 3  git checkout -b <type>/<number>-<slug>
        # type = feat | fix | docs | chore
        # slug = 2-3 word kebab-case summary of the issue title
STEP 4  gh issue comment <number> --body "..."
        # post implementation plan: files, approach, key references, verification
STEP 5  implement
```

**This sequence is non-negotiable.** Do not skip or reorder any step. Do not commit to the current branch. Do not reuse an existing feature branch. Create a fresh branch from main every time.

## Pull requests

**Never open a pull request unless the user explicitly asks for one.**

## When the user asks a question — give an opinion

When the user asks a question ("what do you think?", "is X better than Y?", "why is this happening?"), always provide a direct opinion or recommendation alongside any explanation. Do not hedge with "it depends" and stop there — state what you would do and why.

## When information is insufficient — ask first

Before implementing any task where the intent, scope, or expected behavior is unclear, **ask the user for clarification**. Do not assume or guess. This applies especially to:

- Bug reports with no reproduction steps or error messages
- Feature requests with ambiguous acceptance criteria
- Issues that could be solved in multiple ways with different trade-offs

Ask a single focused question covering all missing details. Do not start implementation until you have enough information to proceed confidently.

## HTML markup discipline

**Never add wrapper elements that serve no purpose.** Before writing any `<div>`, `<section>`, or other container, ask: does this element add layout, semantics, or behaviour that the parent cannot already provide? If not, remove it.

Specific rules:

- Do not wrap a single child component in a `<section>` or `<div>` just to apply `display: flex; align-items: center` — if the parent slot already handles centering (e.g. `LobbyLayout` with `mainPlacement="center"`), the wrapper is redundant.
- Do not add `grid-area` on a component's root element when the parent grid already assigns `grid-area: main` to the slot's direct child.
- Lobby components (`*Lobby.vue`) must render `GameLobbyWizard` as the root element, with no enclosing `<section>` or `<div>`.
- If you find yourself adding a wrapper only to transfer styles that the parent layout already provides, delete the wrapper and rely on the layout instead.

## ESLint configuration

**Never modify `eslint.config.js` unless the user explicitly asks.** This includes adding overrides, disabling rules for new directories, or adjusting thresholds. Fix lint violations by refactoring the code to comply with existing rules — not by loosening them.

@.github/rules/code-style.md
@.github/rules/testing.md
@.github/rules/security.md
