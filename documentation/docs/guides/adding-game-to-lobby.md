---
sidebar_position: 2
---

# Adding a Game to the Lobby

The Games Lobby (`/games/Lobby`) is a shared room-discovery and matchmaking hub. Adding a new game requires changes to **three files only** — the rest wires up automatically.

## Prerequisites

Your game must follow the P2P multiplayer pattern described in [Building a P2P Multiplayer Word Game](./p2p-multiplayer-word-game.md):

- A Pinia store with a `playerList` computed ref (array of `{ id, name, color }`)
- A root Vue component (e.g. `MyGame.vue`) that reads `route.query.room` to join a P2P room
- A header component that detects lobby mode via `route.query.game` (see step 3 below)

---

## 1. Register the game type

`src/types/lobby.ts` is the single source of truth for game types. `GameType` is derived from the array, so adding a string here is all that's needed for the type system:

```ts
// src/types/lobby.ts
export const GAME_TYPES = [
  'Pictionary',
  'SquaresMultiplayer',
  'WordleMultiplayer',
  'Minigolf',
  'MyGame' // ← add here
] as const

export type GameType = (typeof GAME_TYPES)[number]
```

---

## 2. Register label and component

Open `src/views/Games/Lobby/constants.ts` and add one entry to each record:

```ts
export const GAME_LABELS: Record<GameType, string> = {
  // ...existing...
  MyGame: 'My Game' // ← display name on the lobby card
}

export const GAME_COMPONENTS: Record<GameType, ReturnType<typeof defineAsyncComponent>> = {
  // ...existing...
  MyGame: defineAsyncComponent(() => import('@/views/Games/MyGame/MyGame.vue'))
}
```

Both records are keyed by `GameType`, so TypeScript will error if any key is missing — no if-chains, no runtime guards.

---

## 3. Wire the player list

Open `src/views/Games/Lobby/Lobby.vue` and add your store to the `gameStores` map. The `gamePlayerList` computed reads from this map automatically:

```ts
import { useMyGameStore } from '@/stores/myGame'

const gameStores: Record<GameType, { playerList: { id: string; name: string; color: string }[] }> =
  {
    // ...existing...
    MyGame: useMyGameStore()
  }
```

The existing `watch(gamePlayerList, ...)` calls `updateRoomPlayers` automatically — no other changes needed.

---

## 4. Add the ← Lobby button to your game's header

When a game is launched from the Lobby, `route.query.game` is set. Your header should detect this and show a back button instead of the room-ID row:

```vue
<!-- MyGameHeader.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

defineProps<{ roomId: string }>()
const emit = defineEmits<{ copyLink: [] }>()

const route = useRoute()
const router = useRouter()
const fromLobby = computed(() => !!route.query.game)
</script>

<template>
  <header class="my-game-header">
    <template v-if="fromLobby">
      <button type="button" @click="router.replace({ query: {} })">← Lobby</button>
    </template>
    <template v-else>
      <code>{{ roomId.slice(0, 8) }}</code>
      <button type="button" @click="emit('copyLink')">Copy link</button>
    </template>
  </header>
</template>
```

`router.replace({ query: {} })` clears all query params, which triggers the lobby's `watch(activeGame)` to auto-close the room and return to the picker.

---

## How the URL routing works

When a user picks a game or joins a room:

```ts
router.replace({ query: { game: 'MyGame', room: '<uuid>' } })
```

The embedded game reads `route.query.room` on mount and joins the P2P room. The lobby reads `route.query.game` to render the correct component. Clearing both params brings the user back to the picker.

---

## Style checklist

Lobby-embedded games should follow the shared game visual language:

| Token                                                                               | Purpose                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------ |
| `--game-ink`                                                                        | Primary text color (dark/light mode aware) |
| `--game-border`                                                                     | Border color for panels, cards, buttons    |
| `--game-surface-subtle`                                                             | Card/panel background                      |
| `font-family: 'Comic Sans MS', 'Chalkboard SE', cursive`                            | Comic-book vibe for game UI                |
| `border: 3px solid var(--game-border)` + `box-shadow: 3px 3px 0 var(--game-border)` | Cartoon panel effect                       |

Define a game-specific accent color (e.g. `--my-game-yellow: #ffd93d`) on the root element and reference it in buttons and highlights. Avoid hardcoded colors — always use `var(--...)` tokens from `_variables.scss`.
