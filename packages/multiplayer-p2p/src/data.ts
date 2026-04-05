import type { DataPayload } from 'trystero/nostr'
import type { P2PSession } from './types'

/**
 * Send typed data to all peers on a named channel.
 * @param session - The active P2P session
 * @param channel - Channel name (must match receiver's channel name)
 * @param payload - Serializable data to broadcast
 */
export const p2pSendData = <T extends DataPayload>(
  session: P2PSession,
  channel: string,
  payload: T
): void => {
  const [send] = session.room.makeAction<T>(channel)
  send(payload)
}

/**
 * Subscribe to typed data arriving on a named channel from any peer.
 * @param session - The active P2P session
 * @param channel - Channel name to listen on
 * @param callback - Called with the payload and the sender's peer ID
 * @returns Unsubscribe function (stops the listener)
 */
export const p2pOnData = <T extends DataPayload>(
  session: P2PSession,
  channel: string,
  callback: (payload: T, peerId: string) => void
): (() => void) => {
  const [, onData] = session.room.makeAction<T>(channel)
  onData((data: T, peerId: string) => callback(data, peerId))
  return () => {}
}
