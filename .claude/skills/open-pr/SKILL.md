---
name: open-pr
description: >-
  Use when explicitly asked to open, raise, create, submit or update a pull request — "open
  the PR", "raise a PR", "make a pull request", "push this up", "update the PR description".
  Covers rebasing onto main, force-pushing safely, the PR body format, keeping the
  description current after each push, watching CI to green, and the abstraction review
  that closes out the work. Never open a pull request unless it was explicitly requested.
---

# Opening a pull request

A pull request is only ever opened on explicit request. If nobody asked for one, the work
ends at the last commit.

## 1. Rebase onto main

```sh
git fetch origin main
git rebase origin/main
```

Resolve any conflicts. Never `git pull`, and never rebase onto the remote feature branch —
always onto main. CI fails if the branch is behind.

```sh
git push --force-with-lease
```

`--force-with-lease`, never `--force`: it refuses when someone else has pushed in the
meantime, instead of destroying their work.

## 2. Run the abstraction review

Before the PR is marked ready, look back over the work and ask what should outlive it.
Route each item by how it would be enforced:

| What came up                                            | Where it belongs                          |
| ------------------------------------------------------- | ----------------------------------------- |
| A mistake a machine could have caught                   | a lint rule, a git hook, or a test        |
| A constraint that will bite anyone working in this area | the matching `.github/instructions/` file |
| A procedure now performed for the second time           | a new skill in `.claude/skills/`          |
| Hard-won context explaining why                         | a journey doc                             |
| Nothing generalizable                                   | say so explicitly                         |

"Nothing generalizable" is a valid and common answer. Writing it down is what stops the
section from becoming a place to invent rules nobody needed.

## 3. Open it

```sh
gh pr create --title "<type>: <summary> (#<issue-number>)" --body-file <file>
```

The issue number belongs in the PR title, so it appears on merge. The body follows
`.github/pull_request_template.md` and starts with `Closes #<issue-number>`, which links
and closes the issue automatically. Do not restate the template here — it is the single
source for the format.

Two sections need care:

- **Added on top of the initial plan** — everything built beyond the original issue scope,
  in plain language, grouped by area, each entry saying what was added and why. Keep it
  current as new commits land; never let it drift behind the branch.
- **Rules and skills to abstract** — the output of step 2.

## 4. Watch CI

```sh
gh pr checks <number> --watch
```

If a check fails, read the actual failure before changing anything:

```sh
gh run view <run-id> --log-failed
```

Fix the cause, commit, push, and repeat until every check passes. Never bypass hooks with
`--no-verify` — if a hook fails, the hook is usually right.

## 5. Keep it current

After every subsequent push, update the description with `gh pr edit` so it still describes
the branch. A PR body that lags behind its commits is worse than no body.

## Definition of done

Every CI check is green, the description matches what is actually on the branch, and the
abstraction review section is filled in — including when the answer is that nothing
generalizes.
