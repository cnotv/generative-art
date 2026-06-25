---
sidebar_position: 9
---

# Package: @webgamekit/music

A thin, framework-agnostic wrapper around [Strudel](https://strudel.cc) (the
JavaScript port of TidalCycles) for generative, in-browser music — plus pure
helpers for turning patterns into rhythm-game note events.

## Installation

```bash
pnpm add @webgamekit/music @strudel/web
```

`@strudel/web` is a peer/runtime dependency provided by the consuming app; the
package imports it lazily so non-browser environments (tests, SSR) never load it.

## Basic Usage

```typescript
import { musicPlay, musicStop, musicSetTempo, MUSIC_SONG } from '@webgamekit/music'

// First call initialises Strudel and loads the default sample bank.
await musicPlay(MUSIC_SONG)

musicSetTempo(0.6) // cycles per second
musicStop()
```

## Exports

| Export                                           | Purpose                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| `musicInit()`                                    | Initialise the Strudel engine + samples once (idempotent). Returns a `Promise`. |
| `musicPlay(pattern)`                             | Initialise if needed, then evaluate/play a Strudel pattern string.              |
| `musicStop()`                                    | Stop all playing patterns (`hush`).                                             |
| `musicSetTempo(cyclesPerSec)`                    | Set the global tempo (`setcps`).                                                |
| `musicRandomDrums(steps?, rng?)`                 | Build a random one-cycle drum pattern string (pure; injectable RNG).            |
| `musicEventsFromHaps(haps, secondsPerCycle)`     | Map queried Strudel haps to ordered `MusicNoteEvent`s (pure).                   |
| `MUSIC_PATTERNS`                                 | Named example patterns: `drums`, `bass`, `melody`, `song`.                      |
| `MUSIC_SONG`                                     | The default complex song used as a rhythm-game track.                           |
| `MusicNoteEvent`, `MusicHap`, `MusicPatternName` | Public types.                                                                   |

## Notes

- Only the `musicInit`/`musicPlay`/`musicStop`/`musicSetTempo` functions touch the
  browser audio engine; `musicRandomDrums` and `musicEventsFromHaps` are pure and
  unit-tested.
- Sound names come from the [dirt-samples](https://github.com/tidalcycles/dirt-samples)
  bank — note the open hi-hat is `ho` (there is no `oh`).
