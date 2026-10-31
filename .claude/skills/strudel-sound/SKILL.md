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
choosing between WAV and MIDI are covered by `workflow:music-sound`, and what a sound should be
made of by `sound-design`; this file is how to do it in this repository. The editor itself is
documented in `documentation/docs/guides/strudel-editor.md`.

## 1. Write the pattern for this editor

Save it as `<name>.strudel` in the scratchpad while iterating.

| What             | Here                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Samples          | everything strudel.cc preloads: dirt-samples, `piano`, the VCSL instruments, mridangam and the uzu drum kit; the sounds tab lists every name |
| Banks            | the tidal drum machines, by full or short name: `.bank("RolandTR909")` or `.bank("TR909")`                                                   |
| Synths           | `sine`, `sawtooth`, `square`, `triangle`, the other superdough synths, the uzu wavetables (`wt_*`) and the General MIDI soundfonts (`gm_*`)  |
| Tempo            | `setcpm(bpm / 4)`: one cycle is a bar of four beats, which the MIDI export assumes too                                                       |
| Pitches for MIDI | `note(...)`, or `n(...)` with `.scale(...)`. A bare `n` on a synth has no pitch in the MIDI file                                             |

## 2. Render it

Check memory and running processes first (the global rules), then start your own dev server on
a free port; never reuse or stop another session's. Then:

```sh
node scripts/strudel-export.mjs <name>.strudel --out <name>.wav --cycles <count> --url http://localhost:<port>
node scripts/strudel-export.mjs <name>.strudel --out <name>.mid --cycles <count> --url http://localhost:<port>
```

The extension picks the format. `--start` is the cycle to begin at and `--cycles` how many to
export, one by default: at `setcpm(30)` one cycle is two seconds. For a one-shot sound effect
pass `--once` instead: it measures one repetition of the pattern and exports just that, so a
pattern sped up with `fast(2)`, such as the Coin example, comes out as a single sound rather than
two. Chromium runs headless with `--mute-audio` and the WAV renders offline.

**Nothing may play aloud.** Never press Play in the browser pane and never run a browser test
that starts audio unmuted: the user may be wearing headphones. A pattern error is printed by
the script and it exits non-zero.

A render stops dead at the end of its last cycle, cutting off any release or reverb. A one-shot
with a tail adds an empty cycle, `cat(sound, silence)`, and renders that too. A loop crossfades
its own end into its start, here 30 ms (1440 samples) of a 96000 sample file, then checks that
the first and last samples agree:

```sh
ffmpeg -i in.wav -filter_complex "[0]asplit=3[t][h][b];[t]atrim=start_sample=94560,asetpts=N/SR/TB[tail];[h]atrim=end_sample=1440,asetpts=N/SR/TB[head];[b]atrim=start_sample=1440:end_sample=94560,asetpts=N/SR/TB[body];[tail][head]acrossfade=ns=1440:c1=qsin:c2=qsin[join];[join][body]concat=n=2:v=0:a=1" -bitexact out.wav
```

The export does not normalise, so set the level afterwards with `volume`: about -16 LUFS for a
game sound, with the peak under -1 dBFS.

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
