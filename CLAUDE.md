# Claude Code Instructions

**Never add rules to this file unless explicitly instructed.**
**Only add strictly Claude Code content to these instructions.**

For project architecture, GitHub workflow, and development patterns, read `.github/copilot-instructions.md`.

## WHEN THE USER LINKS A GITHUB ISSUE — MANDATORY SEQUENCE

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

@.github/rules/code-style.md
@.github/rules/testing.md
@.github/rules/security.md
