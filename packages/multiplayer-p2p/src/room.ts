import { joinRoom, selfId } from 'trystero/nostr'
import type { P2PConfig, P2PSession } from './types'

/**
 * Check whether the browser exposes crypto.subtle (requires HTTPS or localhost).
 * @returns true if the environment supports P2P
 */
export const p2pIsSupported = (): boolean => {
  const supported = typeof window !== 'undefined' && typeof window.crypto?.subtle !== 'undefined'
  if (!supported) {
    console.warn(
      '[p2p] crypto.subtle is not available. ' +
        'P2P requires a secure context (HTTPS or localhost). ' +
        `Current origin: ${typeof window !== 'undefined' ? window.location.origin : 'unknown'}`
    )
  }
  return supported
}

/**
 * Join a P2P room using WebRTC via Trystero (torrent signaling — no server required).
 * All peers in the same roomId can communicate directly.
 * Requires a secure context (HTTPS or localhost) — throws if crypto.subtle is unavailable.
 * @param roomId - Shared identifier for the game room (e.g. "level-1-abc123")
 * @param config - Optional configuration overrides
 * @returns A P2PSession with the room handle and destroy function
 */
export const p2pJoin = (roomId: string, config?: P2PConfig): P2PSession => {
  if (!p2pIsSupported()) {
    throw new Error(
      `P2P is not supported on this origin (${window.location.origin}). ` +
        'Serve the app over HTTPS or use localhost.'
    )
  }

  const appId = config?.appId ?? 'webgamekit'
  const room = joinRoom({ appId }, roomId)

  const destroy = () => {
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
 * Return the IDs of all peers currently connected in the room.
 * Use this immediately after joining to catch peers that joined before you.
 * @param session - The active P2P session
 * @returns Array of peer IDs already in the room
 */
export const p2pGetPeerIds = (session: P2PSession): string[] => {
  return Object.keys(session.room.getPeers())
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
    callback(peerId)
  })
}
