---
sidebar_position: 16
---

# Pictionary

Real-time multiplayer Pictionary built on top of the existing P2P, chat, and dictionary packages.

## Package split

Two framework-agnostic packages were added to keep the view thin and the logic testable:

| Package                  | Responsibility                                                                    |
| ------------------------ | --------------------------------------------------------------------------------- |
| `@webgamekit/chat`       | `ChatMessage` type, `chatMessageCreate`, `chatHistoryAppend`, guess matching      |
| `@webgamekit/dictionary` | Word lists (easy/medium/hard JSON) + `dictionaryPickRandom`, `dictionaryMaskWord` |

Everything that is not Vue-specific lives in a package. The view only handles wiring, layout, and reactivity.

## Session orchestration

`usePictionarySession.ts` owns the P2P session and round state machine. A `PictionaryContext` object bundles the reactive refs, store, options, and apply helpers; module-level helpers (`startRoundForContext`, `pickWordForContext`, `restartGameForContext`, …) operate on that context. This was driven by the `max-lines-per-function` lint limit — the factory would otherwise balloon past 150 lines with all channel bindings inline.

### Channels

```
chat            — ChatMessage
stroke          — { x0, y0, x1, y1, color, size }
clear           — { ts }
round-choices   — { number, drawerId, choices, endsAt }   // 10s picking phase
round           — { number, drawerId, word, endsAt }      // drawing phase
round-end       — { number, intermissionEndsAt }
score           — { guesserId, drawerId, points, drawerPoints }
avatar          — { name, color }
hello           — { id }
restart         — { ts }
```

### Phase machine

`lobby → choosing → drawing → intermission → …` looping until `round.number === totalRounds`, then `summary`. The host is the owner of the canonical state; every transition (`startRound`, `pickWord`, `endRound`, `restartGame`) writes locally via an `apply*` function **and** broadcasts to peers. Peers run the same `apply*` on receive. This keeps the host/peer code paths symmetric.

## Close-guess detection

Chat guesses off by one character show a system hint (`"Alice is very close!"`). `chatEditDistance` is a pure-functional Levenshtein in `packages/chat/src/match.ts` — written as nested `reduce` returning new arrays to satisfy `functional/immutable-data`. The `CLOSE_MAX_DISTANCE = 1` constant makes the threshold easy to tune.

## Timer synchronization

Every timed phase (choosing, drawing, intermission) broadcasts an absolute `endsAt` timestamp instead of a duration. Each peer computes `Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))` locally, so clock drift is bounded and late-joiners land on the correct remaining time. A single `watch(round.endsAt, …)` in the view drives both the choosing-phase auto-pick (drawer) and the drawing-phase auto-end (host).

## Word banner overflow

Combining 2-3 words joined by space can produce long strings (`periscope armadillo stethoscope`) that blow out the grid cell. Fixes:

```css
.pictionary__word-banner {
  box-sizing: border-box;
  width: 100%;
  max-width: min(600px, 100%);
}
.pictionary__banner-word {
  font-size: clamp(1.25rem, 4vw, 2.5rem);
  word-break: break-word;
  overflow-wrap: anywhere;
}
.pictionary__play {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}
```

`min-width: 0` is essential — grid/flex children default to `min-content`, which prevents them from shrinking below their intrinsic width, defeating `max-width: 100%`.

## Chat message kinds

`ChatMessage.kind: 'user' | 'system' | 'success'` replaces an earlier senderId-based check. `ChatMessage.vue` applies `--system` / `--success` modifier classes and exposes CSS custom properties so the consuming view themes them without modifying the component:

```css
.pictionary__chat :deep(.chat-message--success) {
  --chat-success-bg: var(--pic-yellow);
  --chat-success-color: #111;
}
```

Kept the package agnostic of Pictionary-specific colors while still giving the view a styling hook.

## Font zoom

Chat-in-Pictionary needs to be readable on mobile. `Chat.vue` exposes `+` / `−` buttons backed by a `fontScale` ref (0.75 – 2, step 0.15) bound via a `--chat-font-scale` CSS custom property. All nested elements inherit via `font-size: inherit`. No emits or prop coupling needed — the scale is internal to the component.

## Random gradients

The page background is four radial gradients at random positions chosen at mount (not per-frame — once). The constants list (`GRADIENT_COLORS`, `GRADIENT_STOP_PERCENT`, `GRADIENT_LAYER_COUNT`) exists purely to avoid `no-magic-numbers` warnings.

## Word lists

Initial word lists were calibrated at a junior-school level, which made rounds finish in seconds. The lists were re-calibrated:

- **easy** — concrete, everyday nouns (was previously medium)
- **medium** — specific concrete nouns (armadillo, periscope, gondola)
- **hard** — abstract / philosophical / loanword (schadenfreude, zeitgeist, hermeneutics)

The point of the game is that guessing must be non-trivial; word choice does more than mechanics to tune difficulty.
