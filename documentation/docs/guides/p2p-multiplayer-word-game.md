---
sidebar_position: 1
---

# Building a P2P Multiplayer Word Game

This guide walks through creating a browser-based multiplayer word game using the patterns established in SquaresMultiplayer and WordleMultiplayer. No server needed — players connect directly via WebRTC.

## Prerequisites

- Vue 3 + TypeScript + Pinia project (Vite)
- `@webgamekit/multiplayer-p2p` package
- `@webgamekit/dictionary` package

## 1. Plan your folder structure

Every game lives in `src/views/Games/<GameName>/` with these files:

```
GameName/
  constants.ts              # grid size, options, room key
  GameNameConstants.ts      # same, if you prefer explicit names
  useGameNameSession.ts     # P2P session + round state machine
  GameName.vue              # root view, grid layout
  GameNameHeader.vue        # room link share
  GameNameLobby.vue         # matchmaking + host controls
  GameNameGame.vue          # interactive game board
  GameNameIntermission.vue  # between-round reveal
  GameNameSummary.vue       # end-of-match leaderboard
  GameNameSidebar.vue       # player list + chat
```

## 2. Define your store

Create `src/stores/gameName.ts` with Pinia:

```typescript
import { ref } from 'vue'
import { defineStore } from 'pinia'

export type GnPlayer = {
  id: string
  name: string
  color: string
  score: number
}

export type GamePhase = 'lobby' | 'playing' | 'intermission' | 'summary'

export const useGameNameStore = defineStore('gameName', () => {
  const phase = ref<GamePhase>('lobby')
  const players = ref<Record<string, GnPlayer>>({})
  const playerList = computed(() => Object.values(players.value))
  const difficulty = ref<DictionaryDifficulty>('medium')
  const totalRounds = ref(3)
  const roundDuration = ref(0) // 0 = no limit

  // ... round-specific state

  return { phase, players, playerList, difficulty, totalRounds, roundDuration }
})
```

## 3. Write the session composable

`useGameNameSession.ts` owns WebRTC channels and the round state machine.

```typescript
import { joinRoom } from '@webgamekit/multiplayer-p2p'
import { useGameNameStore } from '@/stores/gameName'

type RoundPayload = {
  number: number
  /* game-specific data */
  endsAt: number | null // null = no time limit
}

export const useGameNameSession = (options: { name: string; color: string; roomId: string }) => {
  const store = useGameNameStore()
  const room = ref<ReturnType<typeof joinRoom> | null>(null)
  const isHost = ref(false)
  const localPeerId = ref('')

  const init = (): void => {
    room.value = joinRoom({ appId: 'your-app-id' }, options.roomId)
    // ... set up channels
  }

  const startRound = (): void => {
    // build round data, broadcast, apply locally
    const endsAt = store.roundDuration > 0 ? Date.now() + store.roundDuration * 1000 : null
    // broadcast({ endsAt, ... })
  }

  return { init, startRound, isHost, localPeerId }
}
```

### Channels pattern

Define one channel per event type. Keep payloads small and serializable:

```typescript
const [sendRound, getRound] = room.value.makeAction<RoundPayload>('round')
const [sendGuess, getGuess] = room.value.makeAction<{ peerId: string; guess: string }>('guess')
const [sendAvatar, getAvatar] = room.value.makeAction<{ name: string; color: string }>('avatar')
```

Every channel has a sender and a receiver. The host sends game events; all peers (including host) apply them via shared `apply*` functions.

## 4. Build the Lobby

Copy `WordleMultiplayerLobby.vue` or `SquaresMultiplayerLobby.vue` as a starting point. The lobby is identical across games — only the CSS prefix and player type differ.

Key pieces:

- `useGameLobby` composable handles the matchmaker room
- Host controls (difficulty, rounds, time limit) are shown only with `v-if="isHost"`
- The Start button is disabled until `playerList.length >= 2`
- Round time select: include `0` with label `'No limit'`

```html
<option v-for="seconds in ROUND_DURATION_OPTIONS" :key="seconds" :value="seconds">
  {{ seconds === 0 ? 'No limit' : `${seconds}s` }}
</option>
```

## 5. Build the Game view

### For a grid-based game (Boggle-style)

Track selection as a path of `[row, col]` pairs:

```typescript
const selectedPath = ref<Array<[number, number]>>([])
const isSelecting = ref(false)

const startSelection = (row: number, col: number): void => {
  isSelecting.value = true
  selectedPath.value = [[row, col]]
}

const extendSelection = (row: number, col: number): void => {
  if (!isSelecting.value || isInPath(row, col)) return
  const last = selectedPath.value[selectedPath.value.length - 1]
  if (!last) return
  // allow all 8 directions
  if (Math.abs(last[0] - row) <= 1 && Math.abs(last[1] - col) <= 1) {
    selectedPath.value = [...selectedPath.value, [row, col]]
  }
}
```

Listen to `pointerdown`/`pointerenter` on cells and `pointerup` on `window`:

```html
<div
  v-for="(letter, colIndex) in row"
  class="game__cell"
  :data-row="rowIndex"
  :data-col="colIndex"
  @pointerdown.prevent="startSelection(rowIndex, colIndex)"
  @pointerenter="extendSelection(rowIndex, colIndex)"
/>
```

#### Diagonal hit-area fix

Gaps between cells block diagonal drags. Extend each cell's pointer hit area without changing visuals:

```css
.game__cell {
  position: relative;
}

.game__cell::after {
  content: '';
  position: absolute;
  inset: -5px; /* covers the gap between cells */
}
```

#### SVG path lines

Add an SVG overlay inside the grid wrapper:

```html
<div class="game__grid-wrapper" ref="gridRef">
  <svg class="game__svg" aria-hidden="true">
    <line
      v-for="line in svgLines"
      :key="line.key"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      class="game__svg-line"
    />
  </svg>
  <div class="game__grid"><!-- cells --></div>
</div>
```

```css
.game__grid-wrapper {
  position: relative;
  display: inline-block;
}
.game__svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.game__svg-line {
  stroke: var(--game-green);
  stroke-width: 6;
  stroke-linecap: round;
  opacity: 0.7;
}
```

Compute line endpoints from cell bounding rects:

```typescript
const getCellCenter = (row: number, col: number) => {
  const grid = gridRef.value
  const cell = cellElements.value[row]?.[col]
  if (!grid || !cell) return null
  const gr = grid.getBoundingClientRect()
  const cr = cell.getBoundingClientRect()
  return { x: cr.left - gr.left + cr.width / 2, y: cr.top - gr.top + cr.height / 2 }
}
```

### For a guess-based game (Wordle-style)

Maintain `currentGuess = ref('')` and submit on Enter. Listen to physical keyboard:

```typescript
const onKeydown = (event: KeyboardEvent): void => {
  if (event.ctrlKey || event.altKey || event.metaKey) return
  if (event.key === 'Enter' && currentGuess.value.length === wordLength.value) {
    emit('submitGuess', currentGuess.value)
    currentGuess.value = ''
  } else if (event.key === 'Backspace') {
    currentGuess.value = currentGuess.value.slice(0, -1)
  } else if (/^[A-Za-z]$/.test(event.key)) {
    currentGuess.value += event.key.toUpperCase()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
```

## 6. No-time-limit support

Use `0` as sentinel for "no limit". Broadcast `endsAt: number | null` instead of a duration:

```typescript
// session
const endsAt = store.roundDuration > 0 ? Date.now() + store.roundDuration * 1000 : null

// main view timer
const startRoundTimer = (): void => {
  if (!round.value.endsAt) {
    timeLeft.value = null
    return
  }
  roundTimer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((round.value.endsAt! - Date.now()) / 1000))
    timeLeft.value = remaining
    if (remaining === 0 && isHost.value) session.endRound()
  }, 250)
}
```

Hide the timer when `timeLeft === null`:

```html
<span v-if="timeLeft !== null" class="game__timer">⏱ {{ timeLeft }}s</span>
```

## 7. Word grouping display

Group found/unfound words by length for a compact overview:

```typescript
type WordSlot = { word: string; claim: ClaimedWord | null }
type WordGroup = { length: number; slots: WordSlot[]; foundCount: number }

const wordGroups = computed((): WordGroup[] => {
  const grouped = validWords.reduce<Record<number, WordSlot[]>>((acc, word) => {
    const len = word.length
    const claim = claimedWords.find((cw) => cw.word.toUpperCase() === word.toUpperCase()) ?? null
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

Reuse this same computed in the game view, intermission, and summary.

## 8. Card color inheritance bug

When using `background: #fff` on a card in a dark-theme OS, text inherits white from the body reset — invisible against the white background. Always pair a light background with an explicit text color:

```css
.game__card {
  background: #fff;
  color: #111; /* required — dark theme body reset makes inherited color white */
}
```

## 9. Intermission and Summary

Both receive `validWords` and `claimedWords` props and render the same `wordGroups` computed. The intermission is scrollable to handle large word lists:

```css
.game__intermission {
  align-items: flex-start; /* not center — overflow above viewport is unreachable */
  overflow-y: auto;
}
```

## 10. Routing and room links

Add the view to `src/router/index.ts`:

```typescript
{ path: '/games/game-name', component: () => import('@/views/Games/GameName/GameName.vue') }
```

The room ID lives in the URL query parameter `?room=<uuid>`. On load:

```typescript
const resolvedRoomId = ((): string => {
  const existing = route.query.room as string | undefined
  if (existing) return existing
  const next = crypto.randomUUID()
  router.replace({ query: { ...route.query, room: next } })
  return next
})()
```

Share the current URL to invite players. The matchmaker (`useGameLobby`) handles discovery for strangers.
