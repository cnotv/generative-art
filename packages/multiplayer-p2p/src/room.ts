import { joinRoom, selfId } from '@trystero-p2p/torrent'
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
  console.warn(`[p2p] joining room "${roomId}" with appId "${appId}"`)
  const room = joinRoom({ appId }, roomId)
  console.warn(`[p2p] joined room "${roomId}", selfId=${selfId}`)

  const destroy = () => {
    console.warn(`[p2p] leaving room "${roomId}"`)
    room.leave()
  }

  return {
    get peerId() {
      return selfId
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

/**
 * Subscribe to a callback fired when a remote peer joins the room.
 * @param session - The active P2P session
 * @param callback - Called with the peer's ID when they join
 */
export const p2pOnPeerJoin = (session: P2PSession, callback: (peerId: string) => void): void => {
  session.room.onPeerJoin((peerId) => {
    console.warn(`[p2p] peer joined: ${peerId}`)
    callback(peerId)
  })
}

/**
 * Subscribe to a callback fired when a remote peer leaves the room.
 * @param session - The active P2P session
 * @param callback - Called with the peer's ID when they leave
 */
export const p2pOnPeerLeave = (session: P2PSession, callback: (peerId: string) => void): void => {
  session.room.onPeerLeave((peerId) => {
    console.warn(`[p2p] peer left: ${peerId}`)
    callback(peerId)
  })
}
