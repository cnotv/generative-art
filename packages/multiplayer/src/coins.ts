import type { CoinState, CoinCollectedEvent, MultiplayerSession } from './types'

/**
 * Notify the server that the local player collected a coin.
 * @param session - The active multiplayer session
 * @param coinId - Unique identifier of the collected coin
 */
export const multiplayerCollectCoin = (session: MultiplayerSession, coinId: string): void => {
  session.socket.emit('coin:collected', { coinId })
}

/**
 * Subscribe to coin-collected events broadcast by the server (from any player).
 * @param session - The active multiplayer session
 * @param callback - Called with the event payload when a coin is collected
 * @returns Unsubscribe function
 */
export const multiplayerOnCoinCollected = (
  session: MultiplayerSession,
  callback: (event: CoinCollectedEvent) => void
): (() => void) => {
  session.socket.on('coin:collected', callback)
  return () => session.socket.off('coin:collected', callback)
}

/**
 * Subscribe to the initial coin state list sent by the server on connect.
 * @param session - The active multiplayer session
 * @param callback - Called with the full coin list from the server
 * @returns Unsubscribe function
 */
export const multiplayerOnCoinsSync = (
  session: MultiplayerSession,
  callback: (coins: CoinState[]) => void
): (() => void) => {
  session.socket.on('coin:list', callback)
  return () => session.socket.off('coin:list', callback)
}
