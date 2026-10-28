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
- The editor loads the same sounds strudel.cc does: dirt-samples, the piano, the VCSL
  instruments, the tidal drum machines with their short names (`.bank("TR909")`), the uzu
  drum kit and wavetables, mridangam, and the General MIDI soundfonts (`gm_piano`,
  `gm_acoustic_bass` and the rest), so code copied from strudel.cc plays unchanged. They load
  on the first Play, or earlier when the sounds tab or the flow canvas opens. Where two banks
  share a name, dirt-samples wins: `bd`, `sd`, `hh` and six more are the dirt kit, not the uzu
  drum kit, so the shipped examples sound as written.

A panel opens on the hints tab, followed by seven of the strudel.cc tabs, an import tab and the
flow tab:

- **hints**: what the pattern is missing for its style (below)
- **welcome**: intro and about
- **patterns**: your saved patterns, then the examples, then the shipped
  electro tunes (Caverave, Good times, Flatrave, Amensister, Dinofunk) plus Bike by Autechre,
  typed in by hand from a score and only approximate, and three songs typed in from guitar
  tabs: the Megalovania riff, Breakfast in America (Supertramp) and the Come as You Are riff
  (Nirvana), played on the General MIDI guitars. Each is a link to its own anchor, so
  `/tools/StrudelEditor#caverave` opens on Caverave, Back returns to the pattern before, and a
  pattern can open in a new tab. The name field at the top saves the code in the editor under
  that name, in local storage; a save is linked like the rest, as `#saved-<name>`, saving under
  a name already used replaces it, and its cross deletes it.
- **sounds**: every sound the editor can play, filtered as on strudel.cc into samples, drum
  machines, synths (soundfonts included) and wavetables, and grouped by where it comes from:
  each sample bank, each drum machine, the General MIDI families from pianos to sound effects.
  Each sound shows a readable name ("Bass drum", "Acoustic bass") with the name code plays it
  by in grey beside it (`rolandtr909_bd`, `gm_acoustic_bass`); search matches either, or the
  group. Clicking a sound plays it once; the number is how many variations `n` picks from.
- **import**: turn an MP3, other audio, a MIDI file or a tab screenshot into a pattern (below)
- **midi**: play or drive MIDI devices (below)
- **reference**: function quick list
- **export**: save the code as a WAV or MIDI file (below)
- **console**: evaluation log
- **settings**: theme and panel position
- **flow**: build a pattern from instrument and effect nodes (below)

![The sounds tab grouped by drum machine: under Roland TR909 and Sakata DPM48, sounds named Bass drum, Clap, Closed hi-hat and the rest, each with its code name and variation count](/img/strudel-editor/sounds-tab.webp)

Every tab has its own anchor, so `/tools/StrudelEditor#midi` opens on the midi tab and
`#flow` opens the flow canvas. Tabs and patterns share the anchor: a name that is a tab opens it,
anything else loads the pattern it names.

Audio starts on the first Play press, since browsers only allow sound after a user gesture.
iOS is stricter: audio has to start inside the tap itself, and the engine download that follows
outlasts it. So `strudelPlayback.ts` creates and resumes the page's one AudioContext before
anything downloads, hands it to Strudel, and resumes it again on every Play or Update. It also
asks for iOS's playback audio session, so an iPhone plays with the ring switch on silent.
Patterns run on the Strudel engine (`@strudel/core`, `@strudel/mini`, `@strudel/transpiler`,
`@strudel/webaudio`, `@strudel/tonal`, `@strudel/draw`, `@strudel/midi`), loaded lazily so the rest of the app
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

Flow replaces typing with a small graph, after [Strudel Flow](https://xyflow.com/strudel-flow) by
[xyflow](https://xyflow.com), the makers of React Flow: its node set, controls, radial menu and look
follow theirs. Add a node from the
palette or with the **+** button in the canvas; the **+** and a right-click both open the radial
menu, split into Instruments, Effects and Sounds. A bar over the canvas sets the tempo in BPM and
the beats in one cycle (**B/C**).

![The starter patch: a Pad played by a Voice through a Filter, with the tempo bar above](/img/strudel-flow/flow-editor-dark.webp)

| Node           | Kind       | What it plays                                                                      |
| -------------- | ---------- | ---------------------------------------------------------------------------------- |
| **Pad**        | instrument | an eight-note grid, arpeggio or chord mode, key, scale and octave                  |
| **Beats**      | instrument | up to eight drum tracks of any sample on up to sixteen steps                       |
| **Chords**     | instrument | a chord progression with preset shapes and editable notes                          |
| **Notes**      | instrument | a `note("…")` line in mini notation                                                |
| **Samples**    | instrument | an `s("…")` line in mini notation                                                  |
| **Code**       | instrument | any Strudel expression, for what the controls do not cover                         |
| **Filter**     | effect     | `lpf` and `lpq`                                                                    |
| **Delay**      | effect     | `delay`, `delaytime` and `delayfeedback`                                           |
| **Space**      | effect     | `room`, `roomsize`, `roomfade`, `roomlp` and `roomdim`                             |
| **Level**      | effect     | `gain`, `pan` and `postgain`                                                       |
| **Envelope**   | effect     | `attack`, `decay`, `sustain` and `release`                                         |
| **Visualizer** | effect     | a pianoroll, punchcard, scope, spiral, pitch wheel or spectrum, picked from a list |
| **Effect**     | effect     | chained calls with no single node to sit on, such as after a whole `stack(...)`    |
| **Voice**      | sound      | the synth or sample bank, written as `sound("…")`                                  |

The Beats node has a sample picker on each track, grouped into kicks, snares, hi-hats, claps,
toms, cymbals and percussion from the loaded kit. Its **Shape** footer sets how many steps play,
how many tracks there are, and whether the variation picker shows under each step: `*2` repeats a
hit within its step, `!2` repeats the step, `@2` stretches it and `/2` plays it every other cycle.
Each track is written as a plain sample line, such as `s("~ cp ~ cp*2")`, so typing a line like
that reads back as a Beats track too. Below the shortlist, each track's picker also lists every
other sample and drum machine in the library, grouped and named as in the sounds tab.

The Samples node has an **Add sample** picker under its pattern, with the same groups and
readable names; picking one appends the sound's code name to the end of the line.

![The flow canvas with a Samples node whose pattern ends in a picked casio sample, next to a Beats node](/img/strudel-editor/flow-sample-picker.webp)

![A Beats node with kick, clap and hi-hat tracks over eight steps, variations shown and the Shape footer open](/img/strudel-flow/beats-node.webp)

All of Strudel's visuals live in one **Visualizer** node: the visual itself, a list to pick its
type, and a toggle for whether it draws **under the line** (`._punchcard()`) or **behind the
code** (`.punchcard()`). Any visual call in the code, with or without the underscore, reads back as
a Visualizer with that type picked, and options such as `{ labels: 1 }` written in the code are
kept. While the pattern plays the node draws the visual live: under the line it sits in the node,
and behind the code it fills the node's full width and height behind its controls, showing the
canvas every background visual shares. A visual only draws the pattern, so calls chained after it go on
an Effect node of their own rather than onto the Visualizer.

A call with no dedicated node, such as `.mask("<1 1 1 0>")`, `.sometimesBy(.2, x => x.ply(2))` or
`.jux(rev)`, sits under **Calls** on the node it follows in the code. Common ones get controls: a
step per cycle to switch on and off for `mask` and `struct`, a knob for the chance of
`sometimesBy`, `someCyclesBy` and `degradeBy`, the amount and subdivision of `swingBy`, and knobs
for `fast`, `slow`, `ply`, `late`, `early`, `velocity`, `speed`, `crush`, `shape` and `hpf`. Any
other call, or one whose argument the controls cannot show (a pattern where a number goes), is
written as `.name(argument)` to edit in place. So is a dedicated call whose argument is a signal
or a slider, such as `.lpf(sine.range(300, 3000))`. Remove a call with its cross, or add one from
the node's **…** menu with **Add call**. Calls chained straight after a `stack(...)` of several
instruments have no single node to sit on, so they gather on one Effect node.

Each node header has a **…** menu with **View code**, which shows what the node writes, **Add
call** and **Remove**. An instrument also has a speaker button that mutes it with `.hush()`; muting every
instrument of a group writes the whole block as `_$:`. Drag a node by its header to arrange the
canvas. Connect an output dot to an input by dragging, or click the output and then the input.
Delete or Backspace removes a selected node and its cables. An instrument has no input, a pair of
nodes connects only once, an effect cannot feed an instrument, and a cable cannot close a loop.

Each connected group of nodes compiles to one `$: <pattern>` block. An instrument passes only
through the effects downstream of it: effects every instrument of the group shares are chained
once after a `stack(...)`, and an effect only one instrument reaches stays on that instrument's
branch inside the stack. The tempo bar writes `setcpm(<bpm>/<beats per cycle>)` above the blocks.
A patch with no instrument, or one whose instrument makes no sound yet, says what to fix instead
of writing code.

The code is the source of truth, and the graph always shows it:

- **Typing** rebuilds the graph each time the code pauses on something that parses as
  JavaScript; while it has a syntax error the graph keeps its last good state.
- **Every chained call has a place.** Calls with a dedicated node get it, any other call sits on
  the node it follows with its arguments kept verbatim, and a `stack(...)` splits into its
  instruments.
  A flat sample line of up to sixteen steps, such as `s("bd ~ [bd,cp] ~")`, becomes Beats tracks;
  a richer one, with sub-sequences or euclidean rhythms, becomes a Samples node, and `note("…")`
  becomes Notes. A head nothing reads, such as
  `n(run(8))`, becomes a Code node.
- Statements that are not patterns, such as `samples('…')` or `const cc = await midin('…')`, are
  kept as setup lines and written back above the blocks. Without any `$:` block, the last
  expression is the pattern, as in Strudel.
- **Editing the canvas** writes the compiled code into the editor and re-plays it if it is
  playing. Opening Flow never rewrites the code by itself.

The graph is also saved in local storage, so node positions survive a visit. **Reset patch** loads
the starter Pad into Voice into Filter at 120 BPM.

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

## Turning a MIDI file into a pattern

Drop a `.mid` file on the same **import** tab. Notes are read straight from the file instead of
heard, so the result is exact rather than a sketch:

| Layer  | Read as                                                                            |
| ------ | ---------------------------------------------------------------------------------- |
| Drums  | General MIDI percussion keys on the drum channel, folded to kick, snare and hi-hat |
| Bass   | the lowest note that starts on each sixteenth step                                 |
| Chords | the major or minor triad closest to every note held across the bar                 |

The tempo is the file's first tempo, and notes are placed by their ticks, so a tempo change inside
the file never shifts them off the grid. Up to 64 bars are read. **Load into editor** replaces the
code, as with audio.

## Turning a tab screenshot into a pattern

Drop a PNG, JPEG or WebP of a bass or guitar tab on the same **import** tab. The picture is read
in a Web Worker with plain image processing, no model, and the file never leaves the browser. A
staff of four lines is read as a bass and one of six as a guitar.

| Read    | From                                                              |
| ------- | ----------------------------------------------------------------- |
| Notes   | the fret numbers on each string line, named from the open strings |
| Lengths | the stems and beams under the staff, and a bracket for triplets   |
| Ties    | a stem with no number above it                                    |
| Bars    | the bar lines, so each bar is one cycle of the pattern            |

It works best on a clean digital screenshot, dark or light, with the rhythm row visible. The
tempo is not read from the picture, so the code starts at 120 BPM: change the number in
`setcps`. A mark it cannot read, such as a slide sign, is skipped and listed in the console tab.
How it works and where it stops is in
[Reading a tab screenshot without a model](../journey/strudel-tab-image-import.md).

## MIDI devices

![The midi tab with its Connect MIDI devices button and the three device snippets](/img/strudel-editor/midi-tab.webp)

On the **midi** tab, **Connect MIDI devices** asks the browser for Web MIDI access and lists the
inputs and outputs it finds, following devices as they are plugged in. Three snippets load
straight into the editor, already naming the first device found:

- **Play a keyboard**: `midikeys` plays an input's notes through a Strudel synth while a pattern
  runs.
- **Turn knobs**: `midin` reads an input's control changes into a running pattern.
- **Drive a synth**: `.midi("<output>")` sends the pattern's notes to an output instead of the
  browser.

## Exporting a WAV or MIDI file

The **export** tab saves the code on screen as a file. Choose the format, the cycle to start at
and how many cycles to export: the default is one. A pattern can repeat inside a cycle, as the
Coin example does with `fast(2)`, so **One repetition** measures how long a single play of it
lasts and sets the length to that, which can be a fraction of a cycle: Coin then exports as one
coin, half a cycle long. The file name defaults to the date. Playback stops while it renders, and Play works
again as soon as the file is saved.

![The export tab with MIDI picked](/img/strudel-editor/export-tab.webp)

| Format | Holds                          | Pick it for                                               |
| ------ | ------------------------------ | --------------------------------------------------------- |
| WAV    | the sound, exactly as it plays | a sound effect, a loop or a track to play as it is        |
| MIDI   | the notes and their timing     | a melody to edit in a DAW, play on a synth or feed a game |

WAV renders offline, faster than real time, as a 16-bit stereo file at the chosen sample rate.
Why the editor renders through its own path rather than Strudel's `renderPatternAudio` is in
[Strudel's published builds and their audio clocks](../journey/strudel-published-builds.md).

MIDI is built from the same events the WAV would play: one track per sound, at the pattern's
tempo with four beats to a cycle. Pitched events keep their `note`, `n` with a `scale`, or
`freq`; drum samples with a General MIDI equivalent (`bd`, `sd`, `hh`, `oh`, `cp` and the rest of
`STRUDEL_DRUM_MIDI_NOTES` in `config.ts`) land on the drum channel. Other samples carry no note
and are left out, and no effect reaches a MIDI file.

`scripts/strudel-export.mjs` does the same from the command line, against a running dev server,
in a muted headless browser:

```sh
node scripts/strudel-export.mjs groove.strudel --out groove.wav --cycles 8
node scripts/strudel-export.mjs groove.strudel --out groove.mid --url http://localhost:5317
```

The format follows the extension; `--start`, `--cycles` and `--rate` set the range and the WAV
sample rate, and `--once` exports one repetition instead of a cycle count.

The flow editor follows [Strudel Flow](https://xyflow.com/strudel-flow) by
[xyflow](https://xyflow.com), whose source is on
[GitHub](https://github.com/xyflow/strudel-flow) under AGPL-3.0. The canvas, the flow tab and the
welcome tab each link back to it.

The electro tunes are ported from [strudel.cc](https://strudel.cc/) repl tunes by Felix Roos
under CC BY-NC-SA 4.0.

The Strudel engine is AGPL-3.0-or-later while this repo is MIT, so a deployed build of this
view carries that obligation. The dependency stays isolated to
`src/views/Tools/StrudelEditor/` for that reason.
