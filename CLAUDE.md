# Claude Code Instructions

**Never add rules to this file unless explicitly instructed.** Rules belong in `AGENTS.md`,
in `.claude/rules/`, or in a skill — not here. This file carries only Claude-specific
wiring.

@AGENTS.md

## Claude-specific notes

- Scoped rules live in `.claude/rules/`, each declaring a `paths:` glob so it loads only when
  a matching file is read. They are not re-injected after `/compact` — they reload the next
  time a matching file is touched, so anything that must always hold belongs in `AGENTS.md`.
- Procedures live in `.claude/skills/` and are selected automatically from the request.
  Invoke one by name to run it explicitly.
- Shared tool permissions are in `.claude/settings.json` and travel with the repo; personal
  ones go in `.claude/settings.local.json`, which is gitignored.
