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
- The first Play loads the same sounds strudel.cc does: dirt-samples, the piano, the VCSL
  instruments, the tidal drum machines with their short names (`.bank("TR909")`), the uzu
  drum kit and wavetables, mridangam, and the General MIDI soundfonts (`gm_piano`,
  `gm_acoustic_bass` and the rest), so code copied from strudel.cc plays unchanged.

A panel opens on the hints tab, followed by six of the strudel.cc tabs, an import tab and the
flow tab:

- **hints**: what the pattern is missing for its style (below)
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
- **flow**: build a pattern from instrument and effect nodes (below)

Audio starts on the first Play press, since browsers only allow sound after a user gesture.
iOS is stricter: audio has to start inside the tap itself, and the engine download that follows
outlasts it. So `strudelPlayback.ts` creates and resumes the page's one AudioContext before
anything downloads, hands it to Strudel, and resumes it again on every Play or Update. It also
asks for iOS's playback audio session, so an iPhone plays with the ring switch on silent.
Patterns run on the Strudel engine (`@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
`@strudel/webaudio`, `@strudel/tonal`, `@strudel/draw`), loaded lazily so the rest of the app
never pays for it. Press the stop button to hush the output; leaving the view stops it too. A
pattern that fails to evaluate shows its error under the editor instead of playing.

## Hints

The hints tab names the pattern's style and goes through the code in three groups, each hint
saying why it matters and showing the code it changes:

- **Review what is there**: layers to mute or visuals to remove, so the hints don't only ever
  add.
- **Missing for** the style: the tempo, instruments and visuals it is usually built with.
- **Keep going**: variations to take a finished pattern further.

Each hint's button (**Add**, **Mute** or **Remove**) makes the change. The list follows the code
as you type.

![The hints tab for a breakbeat pattern: layers to review, and ideas to keep going](/img/strudel-editor/hints-tab.webp)

The style comes from the first of these that names one, and the tab says which:

1. the **Style** picker at the top of the tab;
2. the comment on the code's first line, such as `// deep house groove` or `// my first dnb tune`;
3. a guess from the tempo the code plays at and the sounds it uses.

There are eight styles: techno, house, drum and bass, hip hop, ambient, trance, dub and
breakbeat. Each has a usual tempo range, the instruments it is built from, and the visuals that
suit it. The table is `STRUDEL_MUSIC_STYLES` in the editor's `config.ts`, and nothing is sent
anywhere.

| Hint           | When it shows                                                  | What its button does                                                           |
| -------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Review**     | a line draws more than one visual                              | removes all but the first, which would otherwise draw over each other          |
|                | a `$:` block plays only instruments the style isn't built with | mutes it as `_$:`, which keeps it in the code; delete the `_` to bring it back |
|                | a `$:` block plays only parts an earlier layer already plays   | mutes it the same way                                                          |
| **Tempo**      | no `setcps` or `setcpm`, or one outside the style's range      | `setcps(<bpm>/60/4)`, replacing the tempo set or under the header comments     |
| **Instrument** | none of the code's sounds or calls plays that part             | a new `$:` block with the layer                                                |
| **Visual**     | the style suits it, and a layer it fits draws nothing yet      | `._punchcard()` or similar, chained onto that layer                            |
| **Keep going** | a layer it suits doesn't have it yet; three at a time          | `.mask("<1 1 1 0>")` or similar, chained onto that layer                       |

Each visual goes on the layer it suits: a punchcard on the drums, a pianoroll on the melody or
chords, a scope on the bass. A layer that already draws something is never offered a second
visual, so no two draw over each other. The ideas are a breakdown every fourth bar, a filter
sweep, a phrase turned round, drum fills, swing, stereo spread and an echo; their table is
`STRUDEL_PATTERN_IDEAS`. To keep a version you like, save it in the patterns tab and build a
variation on a copy.

Instruments are read from sound names in strings (`bd` is a kick, `hh` a hi-hat, `jvbass` a bass),
from notes (octave 2 and below is bass, above is melody), and from calls (`chord` and `voicing`
are chords, `scale` a melody). Words in comments name the style but never an instrument, so
`// bass and hats` counts as neither. A muted block counts as nothing.

Strudel plays only the `$:` blocks once any exists, so the first instrument added to a plain
pattern turns that pattern into a block too, and both keep playing. Only `$:` blocks can be muted
on their own, so a single plain pattern is never reviewed. Every snippet uses only the sounds the
editor loads and Strudel's built-in synths.

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

## The flow editor

The **Code** and **Flow** switch above the editor changes what fills the left side. Choosing Flow
also opens the flow tab in the player panel; choosing Code puts the code editor back. The player
tabs keep working in either mode, so hints, patterns and settings stay one click away. The panel
button beside the switch hides the player panel when the graph needs the width; the same button
brings it back.

Flow replaces typing with a small graph. Add a node from the palette or with the **+** button in
the canvas; the **+** and a right-click both open the radial menu, split into Instruments and
Effects. The palette adds four instruments and six effects:

| Node         | Kind       | What it plays                                                     |
| ------------ | ---------- | ----------------------------------------------------------------- |
| **Pad**      | instrument | an eight-note grid, arpeggio or chord mode, key, scale and octave |
| **Beats**    | instrument | a sixteen-step kick, snare and hi-hat grid                        |
| **Chords**   | instrument | a chord progression with preset shapes and editable notes         |
| **Code**     | instrument | any Strudel expression, for what the controls do not cover        |
| **Filter**   | effect     | `lpf` and `lpq`                                                   |
| **Delay**    | effect     | `delay`, `delaytime` and `delayfeedback`                          |
| **Space**    | effect     | `room`, `roomsize`, `roomfade`, `roomlp` and `roomdim`            |
| **Level**    | effect     | `gain`, `pan` and `postgain`                                      |
| **Envelope** | effect     | `attack`, `decay`, `sustain` and `release`                        |
| **Scope**    | effect     | a waveform and scale, written as `analyze("flow-scope")`          |

Drag a node by its header to arrange the canvas. Connect an output dot to an effect input by
dragging, or click the output and then the input. The cross on a node, or Delete/Backspace while
it is selected, removes the node and its cables. An instrument has no input, a pair of nodes
connects only once, an effect cannot feed an instrument, and a cable cannot close a loop. New
nodes are placed in the first free slot and the canvas frames them.

Each connected group of nodes compiles to one `$: <pattern>` block. A group stacks its
instruments and then applies its effects in signal order. The **Tempo** field writes
`setcpm(<bpm>/4)` above the blocks. A patch with no instrument, or one whose instrument makes no
sound yet, says what to fix instead of writing code, and Play does nothing until it is fixed.

While Flow is open every valid patch is written into the code editor, so the same Play, Update
and Stop button drives the graph. Switch to Code to read or hand-edit the pattern: a code edit,
an applied hint or a picked pattern is parsed back into nodes, so the graph and the code stay in
sync in both directions. Recognised pad, chord, drum and effect calls keep their controls; an
expression the parser cannot map becomes a Code node, and an unsupported stack of instruments is
kept as one Code node so the sound is not lost. Picking a listed pattern or opening a pattern
anchor switches back to Code, so the picked code is shown in the editor rather than replaced by
a compiled flow version.

The patch and its tempo are saved in local storage, apart from the code. **Reset patch** brings
back the starter Pad into Filter at 120 BPM. A graph emptied down to nothing stays empty on the
next visit rather than silently returning the starter patch.

The graph has one effect chain per connected group, so an effect applies to every instrument
stacked in that group rather than to one branch alone.

## Autocomplete

Typing in the editor lists what can come next, and Ctrl+Space opens the list anywhere. Up and
down move through it, Enter writes the selected option, and Escape closes it. The list is narrow
and tall, so the documentation beside it has room to be up to 800px wide. It drops under the
list when the screen has no room beside it.

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
