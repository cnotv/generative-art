---
sidebar_position: 2
---

# Adding a Game to the Lobby

The Games Lobby (`/games/Lobby`) is a shared room-discovery and matchmaking hub. It embeds existing games via `defineAsyncComponent` and tracks their player lists via Pinia stores. This guide covers the four integration points you need to wire up when adding a new game.

## Prerequisites

Your game must already follow the P2P multiplayer pattern described in [Building a P2P Multiplayer Word Game](./p2p-multiplayer-word-game.md):

- A Pinia store with a `playerList` computed ref (array of `{ id, name, color }`)
- A root Vue component (e.g. `MyGame.vue`) that reads `route.query.room` to join a P2P room
- A header component that can detect lobby mode via `route.query.game`

---

## 1. Register the game type

Open `src/views/Games/Lobby/constants.ts` and add your game to `GAME_TYPES` and `GAME_LABELS`:

```ts
export const GAME_TYPES = [
  'Pictionary',
  'SquaresMultiplayer',
  'WordleMultiplayer',
  'MyGame'
] as const
export type GameType = (typeof GAME_TYPES)[number]

export const GAME_LABELS: Record<GameType, string> = {
  Pictionary: 'Pictionary',
  SquaresMultiplayer: 'Squares',
  WordleMultiplayer: 'Wordle',
  MyGame: 'My Game' // display name on the lobby card
}
```

---

## 2. Register the async component

In `src/views/Games/Lobby/Lobby.vue`, add your game to the `GAME_COMPONENTS` map:

```ts
const GAME_COMPONENTS: Record<GameType, ReturnType<typeof defineAsyncComponent>> = {
  Pictionary: defineAsyncComponent(() => import('@/views/Games/Pictionary/Pictionary.vue')),
  SquaresMultiplayer: defineAsyncComponent(
    () => import('@/views/Games/SquaresMultiplayer/SquaresMultiplayer.vue')
  ),
  WordleMultiplayer: defineAsyncComponent(
    () => import('@/views/Games/WordleMultiplayer/WordleMultiplayer.vue')
  ),
  MyGame: defineAsyncComponent(() => import('@/views/Games/MyGame/MyGame.vue'))
}
```

The lobby will render the active game's component when `route.query.game === 'MyGame'`.

---

## 3. Wire the player list

The lobby needs to sync its room's player count with whoever is currently in the game. Add your store to the `gamePlayerList` computed in `Lobby.vue`:

```ts
import { useMyGameStore } from '@/stores/myGame'
const myGameStore = useMyGameStore()

const gamePlayerList = computed(() => {
  if (activeGame.value === 'Pictionary') return pictionaryStore.playerList
  if (activeGame.value === 'SquaresMultiplayer') return squaresStore.playerList
  if (activeGame.value === 'WordleMultiplayer') return wordleStore.playerList
  if (activeGame.value === 'MyGame') return myGameStore.playerList
  return []
})
```

The existing `watch(gamePlayerList, ...)` will call `updateRoomPlayers` automatically — no further changes needed.

---

## 4. Add the ← Lobby button to your game's header

When a game is launched from the Lobby, `route.query.game` is set. Your header should detect this and replace the room-ID row with a back button:

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

## 5. (Optional) Add a CSS deep override for embedded padding

The lobby embeds your game inside `.lobby__game-embed`. Each game root normally has `padding-top: calc(var(--nav-height) + var(--spacing-3))`. When embedded, this must be reduced to just `var(--nav-height)` so the ← Lobby button sits flush below the fixed nav bar.

Add a deep selector in `Lobby.vue`'s `<style scoped>`:

```css
.lobby__game-embed :deep(.my-game),
.lobby__game-embed :deep(.wm),
.lobby__game-embed :deep(.wl),
.lobby__game-embed :deep(.pictionary) {
  padding-top: var(--nav-height);
}
```

Replace `.my-game` with your root element's BEM class name.

---

## How the URL routing works

When the user picks a game or joins a room, the lobby calls:

```ts
router.replace({ query: { game: 'MyGame', room: '<uuid>' } })
```

The embedded game's composable reads `route.query.room` on mount and joins the corresponding P2P room. The lobby itself reads `route.query.game` to decide which component to render. Clearing both params (`router.replace({ query: {} })`) brings the user back to the picker screen.
