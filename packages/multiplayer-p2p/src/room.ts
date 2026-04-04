import { joinRoom } from 'trystero/nostr'
import type { P2PConfig, P2PSession } from './types'

/**
 * Join a P2P room using WebRTC via Trystero (NOSTR signaling — no server required).
 * All peers in the same roomId can communicate directly.
 * @param roomId - Shared identifier for the game room (e.g. "level-1-abc123")
 * @param config - Optional configuration overrides
 * @returns A P2PSession with the room handle and destroy function
 */
export const p2pJoin = (roomId: string, config?: P2PConfig): P2PSession => {
  const appId = config?.appId ?? 'webgamekit'
  const room = joinRoom({ appId }, roomId)

  let peerId = ''
  room.onPeerJoin((id: string) => {
    if (!peerId) peerId = id
  })

  const destroy = () => {
    room.leave()
  }

  return {
    get peerId() {
      return peerId
    },
    room,
    destroy
  }
}

/**
 * Leave a P2P room and clean up all connections.
 * @param session - The session returned by p2pJoin
 */
export const p2pLeave = (session: P2PSession): void => {
  session.destroy()
}
