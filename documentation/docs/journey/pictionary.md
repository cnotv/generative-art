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
stroke          — StrokeEvent { from, to, options }
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

Initial word lists were calibrated at a junior-school level, which made rounds finish in seconds. The lists were re-calibrated with length constraints:

- **easy** — concrete, everyday nouns (short words OK)
- **medium** — specific concrete nouns, 7+ letters (armadillo, periscope, gondola)
- **hard** — multi-word phrases or 10+ letter abstracts (butterfly effect, broken heart, procrastination)

The length constraints ensure difficulty scales with both concept abstractness and word length — longer words are harder to guess from partial hints.

## CanvasEditor integration

The initial `DrawingCanvas.vue` was a standalone component with its own color picker, brush slider, and canvas logic. It was replaced with the reusable `CanvasEditor` component from `src/components/CanvasEditor/`, which already had undo/redo, fill tool, brush size picker, and storage. Extensions made for Pictionary:

| Feature               | Where                                                     | Why                                                    |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `StrokeEvent` type    | `@webgamekit/canvas-editor`                               | Per-segment `{ from, to, options }` for P2P broadcast  |
| `onStrokeCallback`    | `useCanvasEditor.ts`                                      | Fires on each stroke segment so the view can broadcast |
| `renderSegment`       | `useCanvasEditor` → `CanvasEditorCanvas` → `CanvasEditor` | Remote peers replay strokes without triggering history |
| `silentClear`         | same chain                                                | Remote clear without pushing to undo stack             |
| `interactive` prop    | `CanvasEditorCanvas`, `CanvasEditor`                      | Non-drawers see the canvas but can't draw              |
| `showTools` prop      | `CanvasEditor`                                            | Hide the toolbar for guessing players                  |
| `disableStorage` prop | `CanvasEditor`                                            | Skip localStorage load/save in game context            |
| `visibleTools` prop   | `CanvasEditorTools`, `CanvasEditor`                       | Choose which toolbar buttons appear                    |
| `hideColorValue` prop | `ColorPicker`                                             | Hide the hex value text                                |

The `CanvasEditorCanvas` wrapper div was also flattened — the outer `.canvas-editor-canvas` div absorbed all styles from the removed `.canvas-editor-canvas__wrapper`.

### Mobile layout: grid vs flex

The mobile drawing phase initially used `display: grid` on `.pictionary__play` to control the word-banner / canvas / tools layout. This prevented `flex-grow: 1` on the canvas-editor from taking effect, causing the canvas to collapse to its intrinsic size. Switching to `display: flex; flex-direction: column` fixed this — the canvas-editor and its inner canvas element both use `flex-grow: 1` to fill available space.

## Component decomposition

The monolithic `Pictionary.vue` (~1200 lines) was split into focused sub-components:

| Component                | Responsibility                              |
| ------------------------ | ------------------------------------------- |
| `PictionaryHeader`       | Room ID display + copy link button          |
| `PictionaryLobby`        | Profile, rules (collapsible), host controls |
| `PictionaryChoosing`     | Word choice phase with countdown            |
| `PictionaryDrawing`      | Word banner + CanvasEditor                  |
| `PictionaryIntermission` | Round countdown timer                       |
| `PictionarySummary`      | Game over screen + fireworks                |
| `PictionarySidebar`      | Player list + chat                          |

Supporting files: `constants.ts` (colors, scoring, config options), `usePictionaryTimer.ts` (countdown logic extracted from watchers).

The parent `Pictionary.vue` is now ~250 lines — a thin layout shell that wires sub-components via props/emits.

## Time-based scoring

Points decrease as the round progresses. `computeTimePoints(ctx, base)` calculates `Math.round(base * remainingMs / totalMs)` with a floor of 10 points. The first correct guesser gets a +50 bonus. The drawer earns per-guess points (base 25) also scaled by time. The round continues until all non-drawers guess or time expires — no longer ending on the first correct guess.

## Player leave/rejoin

On disconnect, the player's score is cached in a `Map<peerId, number>` and a system message is posted to chat. On rejoin (avatar channel), the cached score is restored via `existing?.score ?? cachedScore`. The cache persists for the session lifetime.

## Tie handling

The summary phase computes `topPlayers` (all players sharing the highest score). If more than one, the banner shows "It's a tie! Alice and Bob share 300 points" using Oxford-comma joining for 3+.

## Difficulty selection fix

The difficulty dropdown in the lobby wasn't affecting word selection. Root cause: `difficulty` was passed as a plain value snapshot (`options.difficulty`) at session init time. When the host changed the dropdown, the session still used the initial value (`'easy'`). Fix: moved `difficulty` into the Pinia store (`usePictionaryStore`) so it's reactive and shared. `broadcastConfig` and `startRoundForContext` now read `ctx.store.difficulty`, which always reflects the current dropdown selection. The config channel also writes to the store on receive, keeping peers in sync.
