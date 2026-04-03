export type {
  PlayerPosition,
  PlayerRotation,
  PlayerState,
  CoinState,
  CoinCollectedEvent,
  MultiplayerConfig,
  MultiplayerSession
} from './types'

export { multiplayerCreate, multiplayerDestroy } from './connection'
export { multiplayerSendPosition, multiplayerOnPlayers } from './players'
export { multiplayerCollectCoin, multiplayerOnCoinCollected, multiplayerOnCoinsSync } from './coins'
