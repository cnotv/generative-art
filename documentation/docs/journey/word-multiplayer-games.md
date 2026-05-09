---
sidebar_position: 17
---

# Word Multiplayer Games

Two P2P multiplayer word games built in one session: **SquaresMultiplayer** (Boggle-style drag-to-spell) and **WordleMultiplayer** (competitive Wordle). Both share the same lobby, matchmaker, sidebar, and session patterns established in Pictionary.

## Architecture

Each game is a standalone view folder containing:

| File                                     | Responsibility                                                        |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `constants.ts`                           | Grid size, keyboard rows, round duration options, matchmaker room key |
| `useSquares/WordleMultiplayerSession.ts` | P2P session, round state machine, payload types                       |
| `*Lobby.vue`                             | Name/color picker, matchmaker widget, host controls                   |
| `*Game.vue`                              | Interactive game board                                                |
| `*Intermission.vue`                      | Between-round word reveal and scores                                  |
| `*Summary.vue`                           | End-of-match leaderboard                                              |
| `*Sidebar.vue`                           | Player list, chat, per-player status                                  |
| `*Header.vue`                            | Room link share                                                       |

Both use `useGameLobby` for matchmaking and `@webgamekit/multiplayer-p2p` for WebRTC.

## SquaresMultiplayer: drag-to-select grid

The core interaction is a click-and-drag path over a letter grid. Cells are tracked as `[row, col]` pairs in `selectedPath`.

### Drag state machine

```typescript
const startSelection = (row: number, col: number): void => {
  isSelecting.value = true
  selectedPath.value = [[row, col]]
}

const extendSelection = (row: number, col: number): void => {
  if (!isSelecting.value || isInPath(row, col)) return
  const last = selectedPath.value[selectedPath.value.length - 1]
  if (!last || !isAdjacent(last[0], last[1], row, col)) return
  selectedPath.value = [...selectedPath.value, [row, col]]
}
```

`isAdjacent` allows all 8 directions (Moore neighborhood):

```typescript
const isAdjacent = (r1: number, c1: number, r2: number, c2: number): boolean =>
  Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1 && !(r1 === r2 && c1 === c2)
```

### Diagonal hit-area extension

Visual gaps between cells create dead zones at diagonal corners. The pointer passes through the gap without triggering `pointerenter` on the next cell. Removing the gap fixes the interaction but makes tiles feel cramped.

The fix: keep the visual gap, but extend each cell's hit area with a CSS `::after` pseudo-element.

```css
.wm-game__grid-cell {
  position: relative;
  /* visual size unchanged */
}

.wm-game__grid-cell::after {
  content: '';
  position: absolute;
  inset: -5px; /* expands hit area 5px in every direction, covering diagonal gaps */
}
```

`pointer-events` on the pseudo-element fires `pointerenter` even when the cursor travels diagonally through the corner gap. The SVG line overlay follows the actual cell centers, so the visual path looks correct regardless.

### SVG path lines

A positioned `<svg>` overlay fills the grid wrapper. Lines connect cell centers computed from `getBoundingClientRect` relative to the grid container:

```typescript
const getCellCenter = (row: number, col: number): { x: number; y: number } | null => {
  const grid = gridRef.value
  const cell = cellElements.value[row]?.[col]
  if (!grid || !cell) return null
  const gridRect = grid.getBoundingClientRect()
  const cellRect = cell.getBoundingClientRect()
  return {
    x: cellRect.left - gridRect.left + cellRect.width / 2,
    y: cellRect.top - gridRect.top + cellRect.height / 2
  }
}

const svgLines = computed(() => {
  const path = selectedPath.value
  if (path.length < 2) return []
  return path.slice(0, -1).flatMap((_, i) => {
    const from = getCellCenter(path[i][0], path[i][1])
    const to = getCellCenter(path[i + 1][0], path[i + 1][1])
    if (!from || !to) return []
    return [{ x1: from.x, y1: from.y, x2: to.x, y2: to.y, key: String(i) }]
  })
})
```

### Full dictionary scan

The grid generator places a handful of seeded words, but many more words happen to be readable by accident. To count all of them:

```typescript
const allFoundWords = eligible.filter((w) => findWordInGrid(grid, w)).map((w) => w.toUpperCase())
const validWords = [...new Set([...placedWords, ...allFoundWords])]
```

This runs once at round start. With a 5×5 grid and a medium word list, it typically finds 15–30 valid words.

### Word grouping by letter count

A flat list of 25 words is hard to scan. Grouping by length produces a compact panel:

```typescript
type WordSlot = { word: string; claim: WmClaimedWord | null }
type WordGroup = { length: number; slots: WordSlot[]; foundCount: number }

const wordGroups = computed((): WordGroup[] => {
  const grouped = props.validWords.reduce<Record<number, WordSlot[]>>((acc, word) => {
    const len = word.length
    const claim =
      props.claimedWords.find((cw) => cw.word.toUpperCase() === word.toUpperCase()) ?? null
    return { ...acc, [len]: [...(acc[len] ?? []), { word, claim }] }
  }, {})
  return Object.entries(grouped)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([length, slots]) => ({
      length: Number(length),
      slots,
      foundCount: slots.filter((s) => s.claim !== null).length
    }))
})
```

The same `wordGroups` computed is reused in the game view, intermission, and summary.

## WordleMultiplayer: competitive Wordle

Each round all players guess the same word simultaneously. The host picks the word and broadcasts it at round start. Players submit guesses; the store tracks `playerGuesses: Record<peerId, GuessRow[]>` so every player's progress is visible in the sidebar.

### Guess result algorithm

Two-pass coloring matches the official Wordle rules:

```typescript
export const computeGuessResult = (guess: string, word: string): LetterStatus[] => {
  const result: LetterStatus[] = Array(word.length).fill('absent')
  const wordLetters = word.split('')
  const guessLetters = guess.split('')

  // Pass 1: mark exact matches
  guessLetters.forEach((letter, i) => {
    if (letter === wordLetters[i]) {
      result[i] = 'correct'
      wordLetters[i] = ''
      guessLetters[i] = ''
    }
  })

  // Pass 2: mark present-but-wrong-position
  guessLetters.forEach((letter, i) => {
    if (!letter) return
    const idx = wordLetters.indexOf(letter)
    if (idx !== -1) {
      result[i] = 'present'
      wordLetters[idx] = ''
    }
  })

  return result
}
```

### On-screen keyboard letter states

The keyboard tracks the best status seen for each letter across all submitted rows:

```typescript
const STATUS_PRIORITY: Record<LetterStatus, number> = { correct: 2, present: 1, absent: 0 }

const letterStatuses = computed(() =>
  props.myGuesses.reduce<Record<string, LetterStatus>>((acc, row) => {
    row.word.split('').forEach((letter, i) => {
      const status = row.result[i]
      const current = acc[letter]
      if (!current || STATUS_PRIORITY[status] > STATUS_PRIORITY[current]) {
        acc[letter] = status
      }
    })
    return acc
  }, {})
)
```

## No-time-limit mode

Setting `roundDuration = 0` as a sentinel avoids a special boolean flag. At session level:

```typescript
const endsAt = store.roundDuration > 0 ? Date.now() + store.roundDuration * 1000 : null
```

`RoundPayload.endsAt: number | null` is broadcast to all peers. In the main view:

```typescript
const startRoundTimer = (): void => {
  if (roundTimer) clearInterval(roundTimer)
  if (!round.value.endsAt) {
    timeLeft.value = null
    return
  }
  roundTimer = setInterval(() => {
    const endsAt = round.value.endsAt
    if (!endsAt) {
      timeLeft.value = null
      return
    }
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    timeLeft.value = remaining
    if (remaining === 0) {
      if (roundTimer) clearInterval(roundTimer)
      if (isHost.value) session.endRound()
    }
  }, 250)
}
```

The timer banner is hidden with `v-if="timeLeft !== null"`, keeping the UI clean in no-limit games.

## Color inheritance bug

Cards used `background: #fff` but no explicit `color`. On a dark OS theme the body text was white — invisible against the white card background. Adding `color: #111` to the card rule fixed it. The lesson: always pair a light `background` with an explicit `color` in scoped component styles, since dark-mode global resets can override the inherited text color.

## Intermission layout with many words

A full dictionary scan can produce 20–30 valid words. With `align-items: center` on the flex container, overflow split equally above and below — words above the viewport were unreachable. Switching to `align-items: flex-start; overflow-y: auto` kept all content scrollable from the top.
