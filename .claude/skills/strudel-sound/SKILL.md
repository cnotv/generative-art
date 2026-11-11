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
documented in [`guides/strudel-editor.md`](https://github.com/cnotv/strudel-node-editor/blob/main/documentation/docs/guides/strudel-editor.md) in strudel-node-editor.

## 1. Write the pattern for this editor

Before writing a named style, look it up: its entry in
[`guides/strudel-genres.md`](https://github.com/cnotv/strudel-node-editor/blob/main/documentation/docs/guides/strudel-genres.md) in strudel-node-editor for the form, groove and harmonic language, and
its `STRUDEL_MUSIC_STYLES` entry in `src/views/Tools/StrudelEditor/config.ts` for the tempo,
roles, instruments and visuals the editor's hints expect.

Note: when modifying a song, always modify the claps and hats too: not every song should sound
the same.

Note: every pattern must include a comment naming the instruments playing (e.g. "bass: sawtooth,
drum: RolandTR909, chord: gm_overdriven_guitar") so the arrangement is readable without
listening.

Save it as `<name>.strudel` in the scratchpad while iterating.

| What             | Here                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Samples          | everything strudel.cc preloads: dirt-samples, `piano`, the VCSL instruments, mridangam and the uzu drum kit; the sounds tab lists every name |
| Banks            | the tidal drum machines, by full or short name: `.bank("RolandTR909")` or `.bank("TR909")`                                                   |
| Synths           | `sine`, `sawtooth`, `square`, `triangle`, the other superdough synths, the uzu wavetables (`wt_*`) and the General MIDI soundfonts (`gm_*`)  |
| Tempo            | `setcpm(bpm / 4)`: one cycle is a bar of four beats, which the MIDI export assumes too                                                       |
| Pitches for MIDI | `note(...)`, or `n(...)` with `.scale(...)`. A bare `n` on a synth has no pitch in the MIDI file                                             |

### Write each thing once

A forty item bar list or a run of `~ ~ ~ ~` is the sign a song is spelled out rather than written.
Say each thing once:

| Repetition                                  | Write                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| sections that last several bars             | `arrange([8, verse], [8, chorus])` over short `<...>` one a bar strings |
| one plan for chords, bass and melody        | a function, `plan(verse, chorus, outro)`, called once for each part     |
| a chorus that returns, or a mask used twice | a `const`                                                               |
| bars a part sits out, the same bar again    | `silence`, `~!8`, `<a!3 b>`                                             |
| a kick that changes each bar                | `cat(k1, k2, k3, k4)` from one bar cells                                |
| the first bars of a section, then a new end | `[7, line], [1, end]`                                                   |
| one bank or one mask on several layers      | `stack(...).bank("RolandTR909")` or `.mask(name)`                       |

Two traps. In a one a bar `<...>` string an item with a weight and no brackets lasts that many
bars: write `[a4@4]`, not `a4@4`. And the hints tab reads sound names from the `$:` block itself,
not from constants, so keep the sample in the block (`s("bd").struct(kicks)`) and the notes of a
bass or chord line inline: a layer written as `s(kicks)` hides its drums from the hints.

After a rewrite, export the old and the new version to MIDI and compare them track by track. Every
note should match at the same time: a refactor must not change the music. The fourteen style songs
were rewritten this way, and [`journey/strudel-genre-songs.md`](https://github.com/cnotv/strudel-node-editor/blob/main/documentation/docs/journey/strudel-genre-songs.md) in strudel-node-editor shows what each
pattern became.

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

For a song, check the harmony from its MIDI export. A track is named after its sound, so give the
chords a sound no other part uses:

```sh
node scripts/strudel-harmony.mjs <name>.mid <chord sound>[,<second chord sound>]
```

It lists every note on a beat outside that bar's chord. Read the list: a blue note, a third over
a power chord or a fifth the voicing leaves out is right, a bass under the wrong chord is not.

## 4. Put it where it is used

| Use                            | Where                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| a game's sound effect or music | `src/assets/audio/`, imported from the view's `config.ts` (as ForestGame imports `jump.wav`) |
| a built-in RhythmGame song     | `src/assets/audio/rhythmgame/`, listed in `SONGS` in the view's `config.ts`, as below        |
| MIDI for the RhythmGame, a DAW | sent to the user; the RhythmGame loads MIDI from a file the player picks                     |
| anything else                  | sent to the user, and committed only when asked                                              |

A RhythmGame song is two patterns of the same length, both committed: `<song>.strudel` is the
backing and `<song>.lead.strudel` the melody the player hits, which never goes in the backing.
Render the backing to WAV, set its level with `ffmpeg` (about -16 LUFS, true peak under -1 dBFS,
`alimiter` with `latency=1` so nothing shifts), and encode it with `-q:a 5`. Export the lead to
`<song>.mid`, which is the chart. The backing's last chord has to die away within two seconds of
the last note, when the round ends.

Commit the `.strudel` source next to the file it renders, so it can be changed and rendered
again. A WAV is about 11 MB a minute at 48 kHz stereo: anything longer than a short effect or
loop goes in as OGG or MP3 (`ffmpeg -i in.wav -q:a 4 out.ogg`), and the WAV stays out of git.
