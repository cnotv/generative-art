---
name: strudel-sound
description: >-
  Use when asked for music, a melody, a beat, a loop, a jingle, a sound effect or any other
  sound in this repository, or to save a Strudel pattern as a WAV or MIDI file. Covers the
  sounds the Strudel Editor has loaded, rendering a pattern with scripts/strudel-export.mjs,
  checking the file without listening to it, and where audio assets go.
---

# Sound from the Strudel Editor

Every sound here is a Strudel pattern rendered by the Strudel Editor, so the file is exactly
what the editor plays and the pattern can be edited and rendered again. Writing the pattern and
choosing between WAV and MIDI are covered by `workflow:music-sound`; this file is how to do it
in this repository. The editor itself is documented in
`documentation/docs/guides/strudel-editor.md`.

## 1. Write the pattern for this editor

Save it as `<name>.strudel` in the scratchpad while iterating.

| What             | Here                                                                                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Samples          | the dirt-samples kit only: `bd`, `sd`, `hh`, `oh`, `cp`, `rim`, `lt`, `mt`, `ht`, `cr`, `rd`, `cb`, `sh` and the rest of `github:tidalcycles/dirt-samples` |
| Banks            | none. `.bank("RolandTR909")` fails with `sound RolandTR909_hh not found`                                                                                   |
| Synths           | `sine`, `sawtooth`, `square`, `triangle`, and the other superdough synths                                                                                  |
| Tempo            | `setcpm(bpm / 4)`: one cycle is a bar of four beats, which the MIDI export assumes too                                                                     |
| Pitches for MIDI | `note(...)`, or `n(...)` with `.scale(...)`. A bare `n` on a synth has no pitch in the MIDI file                                                           |

## 2. Render it

Check memory and running processes first (the global rules), then start your own dev server on
a free port; never reuse or stop another session's. Then:

```sh
node scripts/strudel-export.mjs <name>.strudel --out <name>.wav --cycles <count> --url http://localhost:<port>
node scripts/strudel-export.mjs <name>.strudel --out <name>.mid --cycles <count> --url http://localhost:<port>
```

The extension picks the format. `--start` is the cycle to begin at and `--cycles` how many to
export, one by default: at `setcpm(30)` one cycle is two seconds. A one-shot sound effect is one
cycle, with the cycle sped up to the effect's length (`setcpm(240)` makes it a quarter of a
second). Chromium runs headless with `--mute-audio` and the WAV renders offline.

**Nothing may play aloud.** Never press Play in the browser pane and never run a browser test
that starts audio unmuted: the user may be wearing headphones. A pattern error is printed by
the script and it exits non-zero.

## 3. Check the file without listening

Read it back instead. For a WAV, the length, and a peak well above zero in the part that
should sound:

```sh
node --input-type=module -e "
import { readFileSync } from 'node:fs'
const wav = readFileSync(process.argv[1]); const rate = wav.readUInt32LE(24)
const pcm = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) / 2)
console.log((pcm.length / 2 / rate).toFixed(2), 's, peak', (pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0) / 32768).toFixed(2))
" <name>.wav
```

For a MIDI file, list its tracks with `@tonejs/midi`: each sound should be a track with the
expected note count, drums on channel 9 (General MIDI channel 10), and the tempo `cpm × 4`.

## 4. Put it where it is used

| Use                            | Where                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| a game's sound effect or music | `src/assets/audio/`, imported from the view's `config.ts` (as ForestGame imports `jump.wav`) |
| MIDI for the RhythmGame, a DAW | sent to the user; the RhythmGame loads MIDI from a file the player picks                     |
| anything else                  | sent to the user, and committed only when asked                                              |

Commit the `.strudel` source next to the file it renders, so it can be changed and rendered
again. A WAV is about 11 MB a minute at 48 kHz stereo: anything longer than a short effect or
loop goes in as OGG or MP3 (`ffmpeg -i in.wav -q:a 4 out.ogg`), and the WAV stays out of git.
