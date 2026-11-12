---
paths:
  - 'src/views/Tools/StrudelEditor/**'
  - 'src/assets/audio/**'
  - '.claude/skills/strudel-sound/**'
---

# Music

Before writing or changing a style or a song, read its entry in
`documentation/docs/guides/strudel-genres.md` and its `STRUDEL_MUSIC_STYLES` entry in
the editor package's `config.ts` in the cnotv/strudel-node-editor repository. The first gives the form, groove, harmony and melody;
the second the tempo, roles, instruments and visuals the hints expect.

A song is a motif, a bass line with its own rhythm, at least two sections and an ending. A
four-bar chord loop with a scale run is a backing track, not a song.

Write the chord plan once, as a `const` of one chord a bar, and derive every part from it, so the
bass, arpeggio and melody cannot drift onto another chord. In a `<...>` one-a-bar string, a lone
item with a weight such as `a4@4` lasts four bars, not four beats: write `[a4@4]`. Check the
harmony from a MIDI export with `scripts/strudel-harmony.mjs` before calling a song finished.

Write sections once with `arrange([8, verse], [8, chorus])` over short `<...>` strings, not as a
forty item list per part, and name any bar that comes back. Keep each layer's sample name in its
own `$:` block, as `s("bd").struct(kicks)`: the hints tab cannot see names inside a constant.

A sample plays its whole length unless the pattern sets `clip`, `legato`, `release`, `loop` or
`cut`, so a busy line on a long sample stacks tails and clips the output. The Instruments tab's
pitched presets end their notes with the event by default; any other long sample needs `.clip(1)`,
or `.cut(n)` to ring until the next hit. A preset plays as `<name>` (single notes),
`<name>:mute` and `<name>:chord`; the older `<name>_<technique>` names stay for the songs.
Presets render only when code or a picker uses them, so anything listing sounds must list the
presets themselves rather than read the sampler's registered sounds.
