import { defineAsyncComponent } from 'vue'
import { GAME_TYPES, type GameType } from '@/types/lobby'

export { GAME_TYPES }
export const LOBBY_CHANNEL = 'games-lobby'
export const REANNOUNCE_MS = 30_000

export const GAME_LABELS: Record<GameType, string> = {
  Pictionary: 'Pictionary',
  SquaresMultiplayer: 'Squares',
  WordleMultiplayer: 'Wordle',
  Minigolf: 'Minigolf',
  PathFight: 'Path Fight'
}

export const GAME_COMPONENTS: Record<GameType, ReturnType<typeof defineAsyncComponent>> = {
  Pictionary: defineAsyncComponent(() => import('@/views/Games/Pictionary/Pictionary.vue')),
  SquaresMultiplayer: defineAsyncComponent(
    () => import('@/views/Games/SquaresMultiplayer/SquaresMultiplayer.vue')
  ),
  WordleMultiplayer: defineAsyncComponent(
    () => import('@/views/Games/WordleMultiplayer/WordleMultiplayer.vue')
  ),
  Minigolf: defineAsyncComponent(() => import('@/views/Games/Minigolf/Minigolf.vue')),
  PathFight: defineAsyncComponent(() => import('@/views/Games/PathFight/PathFight.vue'))
}
