export const GAME_TYPES = [
  'Pictionary',
  'SquaresMultiplayer',
  'WordleMultiplayer',
  'Minigolf',
  'BubbleShooter',
  'RhythmGame',
  'MarbleMadness'
] as const

export type GameType = (typeof GAME_TYPES)[number]

export type LobbyPlayer = {
  id: string
  name: string
  color: string
}

export type LobbyRoom = {
  id: string
  name: string
  game: GameType
  hostId: string
  hostName: string
  players: LobbyPlayer[]
  isHidden: boolean
  createdAt: number
}
