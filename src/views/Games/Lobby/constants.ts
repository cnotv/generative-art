import type { GameType } from '@/types/lobby'

export const LOBBY_CHANNEL = 'games-lobby'
export const REANNOUNCE_MS = 30_000

export const GAME_LABELS: Record<GameType, string> = {
  Pictionary: 'Pictionary',
  SquaresMultiplayer: 'Squares',
  WordleMultiplayer: 'Wordle'
}

export const GAME_TYPES: GameType[] = ['Pictionary', 'SquaresMultiplayer', 'WordleMultiplayer']
