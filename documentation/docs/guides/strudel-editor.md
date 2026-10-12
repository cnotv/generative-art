---
sidebar_position: 25
---

# Live-coding music with Strudel

The Strudel Editor at `/tools/StrudelEditor` reproduces the strudel.cc player: pick a pattern,
edit the code, and press Play. A bottom panel carries the same seven tabs as strudel.cc:

- **welcome**: intro and about
- **patterns**: the shipped electro tunes (Caverave, Good times, Flatrave, Amensister, Dinofunk)
- **sounds**: sound browser
- **reference**: function quick list
- **export**: WAV export settings
- **console**: evaluation log
- **settings**: theme and panel position

Audio starts on the first Play press, since browsers only allow sound after a user gesture.
Patterns run on the Strudel engine (`@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
`@strudel/webaudio`, `@strudel/tonal`), loaded lazily so the rest of the app never pays for
it. Press Stop to hush the output; leaving the view stops it too.

The electro tunes are ported from [strudel.cc](https://strudel.cc/) repl tunes by Felix Roos
under CC BY-NC-SA 4.0.

The Strudel engine is AGPL-3.0-or-later while this repo is MIT, so a deployed build of this
view carries that obligation. The dependency stays isolated to
`src/views/Tools/StrudelEditor/` for that reason.
