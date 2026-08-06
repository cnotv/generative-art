# Claude Code Instructions

**Never add rules to this file unless explicitly instructed.** Rules belong in `AGENTS.md`,
in `.github/instructions/`, or in a skill — not here. This file carries only Claude-specific
wiring.

@AGENTS.md

## Claude-specific notes

- Scoped rules are also imported by nested `CLAUDE.md` files in `src/views/`,
  `src/components/LobbyUI/` and `packages/`, so they load when working in those directories.
- Procedures live in `.claude/skills/` and are selected automatically from the request.
  Invoke one by name to run it explicitly.
- Shared tool permissions are in `.claude/settings.json` and travel with the repo; personal
  ones go in `.claude/settings.local.json`, which is gitignored.
