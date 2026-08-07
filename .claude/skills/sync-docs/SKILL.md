---
name: sync-docs
description: >-
  Use after changing any file that a tutorial documents, and when asked to check whether
  docs are stale, out of date, or still accurate — "update the docs", "is the guide still
  right", "did this break a tutorial". Covers finding which guides track the changed file,
  and fixing every snippet, option name and path the change affected. Applies to guides in
  documentation/docs/guides that carry a "Source files" note, including the timeline,
  LobbyUI, track-piece and ball-spawning tutorials.
---

# Keeping tutorials in sync with the code

A tutorial that describes an API which no longer exists is worse than no tutorial: it
teaches the wrong thing confidently, and every stale command someone runs and watches fail
trains them to distrust the docs.

## Find what tracks the file you changed

Guides declare their dependencies in a `Source files` note. Search for the ones that name
what you touched rather than working from a list — a hardcoded mapping goes stale exactly
the way the docs do:

```sh
grep -rln "Source files" documentation/docs/guides/
grep -rln "<path/you/changed>" documentation/docs/guides/
```

If a guide you are editing has no `Source files` note and clearly tracks specific files,
add one, using the existing notes as the pattern.

## Fix what the change affected

Re-read the whole guide, not just the section that looks relevant. Check every:

- code snippet — does it still compile against the new signature?
- option, prop and config key name — was any renamed or removed?
- file path — does it still resolve?
- command — does it still work on a fresh clone?

Do this in the same change that altered the code. A follow-up commit to fix docs is a
commit that does not happen.

## Definition of done

Every guide that names the changed file has been re-read and corrected, and `pnpm docs:build`
passes — Docusaurus fails the build on broken internal links, so a clean build is real
evidence rather than a spot check.
