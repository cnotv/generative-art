export type GameType = 'Pictionary' | 'SquaresMultiplayer' | 'WordleMultiplayer'

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
