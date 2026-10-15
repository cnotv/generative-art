---
sidebar_position: 25
---

# Live-coding music with Strudel

The Strudel Editor at `/tools/StrudelEditor` reproduces the strudel.cc player: pick a pattern,
edit the code, and press Play. A bottom panel carries the seven strudel.cc tabs plus an import tab:

- **welcome**: intro and about
- **patterns**: the shipped electro tunes (Caverave, Good times, Flatrave, Amensister, Dinofunk),
  plus Bike by Autechre, typed in by hand from a score and only approximate
- **import**: turn an MP3 or other audio file into a pattern (below)
- **sounds**: sound browser
- **reference**: function quick list
- **export**: WAV export settings
- **console**: evaluation log
- **settings**: theme and panel position

Audio starts on the first Play press, since browsers only allow sound after a user gesture.
Patterns run on the Strudel engine (`@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
`@strudel/webaudio`, `@strudel/tonal`), loaded lazily so the rest of the app never pays for
it. Press Stop to hush the output; leaving the view stops it too.

## Turning an MP3 into a pattern

Open the **import** tab and drop an audio file on it, or click to browse. Anything the browser
can decode works: MP3, WAV, OGG, M4A, FLAC. The file never leaves the browser. It is decoded to
mono, analysed in a Web Worker, and summarised as a tempo, a bar count and a chord progression,
with the generated code underneath. Press **Load into editor** to replace the editor's code
with it, then Play.

![The import tab after transcribing a drum, bass and chord loop](/img/strudel-editor/import-tab.webp)

The generated pattern stacks up to three layers, leaving out any the audio did not have:

| Layer  | Heard as                                                      | Played with             |
| ------ | ------------------------------------------------------------- | ----------------------- |
| Drums  | kick, snare and hi-hat on a sixteenth-note grid               | the dirt-samples kit    |
| Bass   | the strongest note between 40 and 250 Hz at each onset        | a filtered sawtooth     |
| Chords | one major or minor triad per bar, or a rest when none matches | `voicing()` on triangle |

Bars that repeat collapse into the shortest loop, so a four-bar progression in a three-minute
song comes out as four bars. Only the first 90 seconds, at most 64 bars, are analysed.

Treat the result as a sketch in the spirit of the track, not a copy. The melody is not
transcribed, chords richer than a triad are reduced to one, and a dense mix confuses the drum
classifier. Edit the code from there. How the analysis works and where it fails is in
[Transcribing audio into a pattern](../journey/strudel-audio-transcription.md).

The electro tunes are ported from [strudel.cc](https://strudel.cc/) repl tunes by Felix Roos
under CC BY-NC-SA 4.0.

The Strudel engine is AGPL-3.0-or-later while this repo is MIT, so a deployed build of this
view carries that obligation. The dependency stays isolated to
`src/views/Tools/StrudelEditor/` for that reason.
