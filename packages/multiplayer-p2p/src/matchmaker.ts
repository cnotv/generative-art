import { p2pJoin, p2pLeave, p2pGetPeerIds, p2pOnPeerJoin, p2pOnPeerLeave } from './room'
import type { P2PConfig, P2PSession } from './types'

export type MatchmakeStatus = 'searching' | 'matched'

export interface MatchmakeHandle {
  /** The underlying P2P session — use this to send/receive game data */
  session: P2PSession
  /** Leave the room and stop matchmaking */
  stop: () => void
}

/**
 * Join a shared room and report status changes as peers arrive or leave.
 *
 * - Calls `onStatusChange('searching', 0)` immediately if no peers are present.
 * - Calls `onStatusChange('matched', n)` whenever peer count rises above zero.
 * - Reverts to `'searching'` if all peers disconnect.
 *
 * @param roomId - Shared room to join (same value for all players in the session)
 * @param config - Optional P2P configuration
 * @param onStatusChange - Fired on initial join and on every peer join/leave
 * @returns A handle with the active session and a `stop()` function to leave
 */
export const p2pMatchmake = (
  roomId: string,
  config: P2PConfig | undefined,
  onStatusChange: (status: MatchmakeStatus, peerCount: number) => void
): MatchmakeHandle => {
  const session = p2pJoin(roomId, config)
  const peers = new Set(p2pGetPeerIds(session))

  const notifyStatus = (): void => {
    onStatusChange(peers.size > 0 ? 'matched' : 'searching', peers.size)
  }

  p2pOnPeerJoin(session, (peerId) => {
    peers.add(peerId)
    notifyStatus()
  })

  p2pOnPeerLeave(session, (peerId) => {
    peers.delete(peerId)
    notifyStatus()
  })

  notifyStatus()

  return {
    session,
    stop: () => p2pLeave(session)
  }
}
