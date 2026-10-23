---
sidebar_position: 25
---

# Live-coding music with Strudel

The Strudel Editor at `/tools/StrudelEditor` reproduces the strudel.cc player: pick a pattern,
edit the code, and press the play button above the editor.

- The button reads **Stop** while the pattern plays, and **Update** once the code has been
  edited since it started; Update, like Ctrl+Enter, swaps the playing pattern and its visuals
  for the edited code. Code that fails to run stops playback rather than leave the old pattern
  going, and loading another pattern stops the one playing.
- The code is saved to the browser's local storage as you type, so a refresh or a later visit
  opens where you left off. An address naming a pattern opens that pattern instead, and picking
  one replaces the saved code.

A panel carries six of the strudel.cc tabs plus an import tab:

- **welcome**: intro and about
- **patterns**: your saved patterns, then the examples, then the shipped
  electro tunes (Caverave, Good times, Flatrave, Amensister, Dinofunk) plus Bike by Autechre,
  typed in by hand from a score and only approximate. Each is a link to its own anchor, so
  `/tools/StrudelEditor#caverave` opens on Caverave, Back returns to the pattern before, and a
  pattern can open in a new tab. The name field at the top saves the code in the editor under
  that name, in local storage; a save is linked like the rest, as `#saved-<name>`, saving under
  a name already used replaces it, and its cross deletes it.
- **import**: turn an MP3 or other audio file into a pattern (below)
- **reference**: function quick list
- **export**: WAV export settings
- **console**: evaluation log
- **settings**: theme and panel position

Audio starts on the first Play press, since browsers only allow sound after a user gesture.
Patterns run on the Strudel engine (`@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
`@strudel/webaudio`, `@strudel/tonal`, `@strudel/draw`), loaded lazily so the rest of the app
never pays for it. Press the stop button to hush the output; leaving the view stops it too. A
pattern that fails to evaluate shows its error under the editor instead of playing.

## The code editor

The editor fills the left side of the screen at full height and scrolls on its own; the
tabs sit on the right. On a phone they stack, editor first. It is
strudel.cc's own CodeMirror setup from `@strudel/codemirror`, so code written there works
here unchanged:

- **Ctrl+Enter** (or Alt+Enter) plays the code, **Ctrl+.** stops it.
- **`slider(value, min, max, step)`** draws a slider in the code. Dragging it rewrites the
  number and changes the sound while it plays. `min` and `max` default to 0 and 1.
- **`._pianoroll()`**, **`._scope()`**, **`._punchcard()`**, **`._spiral()`**,
  **`._pitchwheel()`** and **`._spectrum()`** draw under the line the call is on.
- **`.pianoroll()`** and **`.scope()`**, without the underscore, draw behind the code.
- Deleting an underscore call removes its drawing and the space under its line at once.
  Every visual the code no longer calls stops and is cleared when the code next runs, with
  Ctrl+Enter or Play, and on Stop.
- The notes that are playing are boxed in the mini-notation as they sound.
- **Autocomplete** lists the options as you type, and resting the pointer on a function's name
  shows its documentation, both described below.

![Inline sliders, pianoroll and scope while the Sliders and scopes example plays](/img/strudel-editor/inline-widgets.webp)

The **Sliders and scopes** example shows all of them at once.

Five more examples show one visual each: **Punchcard drums**, **Spiral**, **Pitch wheel**,
**Spectrum** and **Pianoroll behind the code**. Each passes the visual a colour through
`.color()`, and each is a starting point for a visual of your own. Two more come from strudel.cc's
visual feedback guide:

- **Punchcard vs pianoroll**: `._punchcard()` draws what everything chained after it does, so a
  later `.color()` shows, while `._pianoroll()` draws the pattern as it stood at the call.
- **Scope**: the guide's `s("sawtooth")._scope()`, then a second scope sized with its `thickness`
  and `scale` options. A scope ignores a `color` option and reads the pattern's `.color()`.

![Punchcard drums, Spiral and Pitch wheel above Spectrum and Pianoroll behind the code, each playing](/img/strudel-editor/visual-examples.webp)

The spiral, the pitch wheel and the spectrum size their drawing in canvas pixels, which is
Strudel's own behaviour. They look smaller on a high-density screen than on a standard one.

## Autocomplete

Typing in the editor lists what can come next, and Ctrl+Space opens the list anywhere. Up and
down move through it, Enter writes the selected option, and Escape closes it.

![Completing a function with its documentation beside the list, and a sound name inside s()](/img/strudel-editor/autocomplete.webp)

| Where the cursor is                   | What it offers                                                        |
| ------------------------------------- | --------------------------------------------------------------------- |
| a name, or straight after a `.`       | every documented function and its synonyms, with its documentation    |
| inside `s("…")` or `sound("…")`       | the sounds the engine has loaded                                      |
| inside `.bank("…")`                   | the banks among those sounds, such as `RolandTR808`                   |
| inside `chord("…")`                   | a root, then Strudel's chord symbols after it, such as `^7` and `-7`  |
| inside `.scale("…")`                  | a root, then a scale name after the colon, written `minor:pentatonic` |
| a comment, or any other mini-notation | nothing                                                               |

Sounds load with the engine, so `s("…")` offers names only after the first Play.

Resting the pointer on a function's name in the code shows the same documentation in a tooltip,
whether it is written as a call, such as `note(`, or chained, such as `.lpf(`, and under any of
its synonyms. Names in comments and strings show nothing. A touch screen has no pointer to rest,
so on a phone the documentation shows only beside the completion list.

![The documentation for lpf in a tooltip over its name](/img/strudel-editor/hover-documentation.webp)

The documentation comes from Strudel itself. `codeEditor/strudelDocumentation.json` is generated from
the JSDoc comments in the installed `@strudel/*` and `superdough` sources, the same comments
strudel.cc builds its reference from. `codeEditor/strudelDocumentation.test.ts` regenerates it and fails
when it differs from the committed file, so upgrading a Strudel package without regenerating
fails the unit tests. To regenerate it:

```sh
pnpm vitest run src/views/Tools/StrudelEditor/codeEditor/strudelDocumentation.test.ts -u
```

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
[Transcribing audio into a pattern](../journey/strudel-audio-transcription.md). Why the editor
is assembled from parts rather than strudel.cc's ready-made one is in
[Embedding the strudel.cc editor](../journey/strudel-editor-widgets.md).

The electro tunes are ported from [strudel.cc](https://strudel.cc/) repl tunes by Felix Roos
under CC BY-NC-SA 4.0.

The Strudel engine is AGPL-3.0-or-later while this repo is MIT, so a deployed build of this
view carries that obligation. The dependency stays isolated to
`src/views/Tools/StrudelEditor/` for that reason.
