---
sidebar_position: 6
---

# Visual Verification with Screenshots

When a change affects 3D positioning, lighting, shadows, camera, animation or layout, unit
tests and type checking cannot tell you whether it looks right. Reading coordinates and
doing the arithmetic in your head is not a substitute for seeing the scene — so drive the
running app with Playwright and look at the rendered frame.

The procedure lives with the tooling that performs it, in `.claude/skills/verify/SKILL.md`:
launching the dev server on its fixed port, the route naming convention, driving a canvas
that intercepts pointer events, choosing a camera angle, and reading shadows as a proxy for
height. Keeping it in one place is deliberate — when the same commands were written out
here as well, the two copies disagreed about which port to use.

The judgement it encodes is worth stating on its own, because it applies well beyond
screenshots: if a fix does not visibly change the result, the assumption behind the fix is
probably wrong. Go back to the underlying values rather than repeating the same check.
