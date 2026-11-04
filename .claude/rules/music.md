---
paths:
  - 'src/views/Tools/StrudelEditor/**'
  - 'src/assets/audio/**'
  - '.claude/skills/strudel-sound/**'
---

# Music

Before writing or changing a style or a song, read its entry in
`documentation/docs/guides/strudel-genres.md` and its `STRUDEL_MUSIC_STYLES` entry in
`src/views/Tools/StrudelEditor/config.ts`. The first gives the form, groove, harmony and melody;
the second the tempo, roles, instruments and visuals the hints expect.

A song is a motif, a bass line with its own rhythm, at least two sections and an ending. A
four-bar chord loop with a scale run is a backing track, not a song.

Write the chord plan once, as a `const` of one chord a bar, and derive every part from it, so the
bass, arpeggio and melody cannot drift onto another chord. In a `<...>` one-a-bar string, a lone
item with a weight such as `a4@4` lasts four bars, not four beats: write `[a4@4]`. Check the
harmony from a MIDI export with `scripts/strudel-harmony.mjs` before calling a song finished.
