---
sidebar_position: 25
---

# Live-coding music with Strudel

The Strudel Editor at `/tools/StrudelEditor` evaluates Strudel mini-notation patterns in the
browser. Pick an example pattern, edit the code, and press Play. Audio starts on that first
press, since browsers only allow sound after a user gesture.

Patterns run on the Strudel engine (`@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
`@strudel/webaudio`, `@strudel/tonal`), loaded lazily so the rest of the app never pays for
it. Press Stop to hush the output; leaving the view stops it too.

The Strudel engine is AGPL-3.0-or-later while this repo is MIT, so a deployed build of this
view carries that obligation. The dependency stays isolated to
`src/views/Tools/StrudelEditor/` for that reason.
