---
name: journey-doc
description: >-
  Use when a fix took more than one attempt, the root cause turned out to be in a library
  or framework rather than our own code, a constraint is invisible from reading the
  codebase, or a design decision came with hard-won context — and use when asked to "write
  it up", "document the why", "add a journey doc", or record a finding, lesson, quirk or
  gotcha. Covers deciding whether a doc is warranted, where it goes, and the prose-and-diagram
  style. Not for API reference, which belongs in the package docs instead.
---

# Writing a journey doc

A journey doc captures the _why_. The code is already in the repo; this is the reasoning
that the code cannot show. The test of a good one: it answers "what would have saved me an
hour if I had read it first?"

## Is one warranted?

Write one when any of these is true:

- The fix required more than one attempt
- The root cause was in a library or framework, not in our own code
- A constraint is invisible in the codebase — something that must be done, where nothing
  in the code says so
- The same mistake is plausible for anyone who touches this area later

Every new game gets its own `<game-name>.md` regardless.

If none of these hold, do not write one. A doc recording something obvious costs more to
read than it saves.

## Where it goes

`documentation/docs/journey/`. Use an existing file if the topic fits; otherwise create
`<topic>.md`:

```markdown
---
sidebar_position: 99
---

# Title: Subtitle

One sentence on the scope of what this page covers.

## Finding title

Abstract prose explaining what the problem was, what made it non-obvious, and what the fix
or the correct mental model is.
```

## Style

Favour abstract prose, tables and Mermaid diagrams. **No code snippets** — include at most
the minimal formula or fragment needed to make the theory concrete. The code lives in the
repo and will change; the reasoning is what needs to survive.

Write it as part of the same change that solved the problem, not later. Documentation is
complete before the PR is opened, not after.

## Definition of done

The doc explains the problem, what made it non-obvious, and the correct mental model,
without reproducing the implementation. It builds: `pnpm docs:build`.
