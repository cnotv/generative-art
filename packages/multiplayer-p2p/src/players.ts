import type {
  PlayerPosition,
  PlayerRotation,
  PlayerState,
  PlayerAction,
  P2PConfig,
  P2PSession
} from './types'

type PositionRecord = Record<string, Record<string, number>>
type ActionRecord = Record<string, string>

const defaultThrottleMs = 30

const pendingTimers = new WeakMap<P2PSession, ReturnType<typeof setTimeout>>()

/**
 * Broadcast the local player's position and rotation to all peers, throttled.
 * @param session - The active P2P session
 * @param position - Current player position {x, y, z}
 * @param rotation - Current player rotation {x, y, z}
 * @param config - Optional config carrying throttleMs
 */
export const p2pSendPosition = (
  session: P2PSession,
  position: PlayerPosition,
  rotation: PlayerRotation,
  config?: P2PConfig
): void => {
  const throttleMs = config?.throttleMs ?? defaultThrottleMs
  const existing = pendingTimers.get(session)
  if (existing !== undefined) clearTimeout(existing)

  const [sendPos] = session.room.makeAction<PositionRecord>('pos')

  pendingTimers.set(
    session,
    setTimeout(() => {
      pendingTimers.delete(session)
      console.warn(`[p2p] sending position`, position, rotation)
      sendPos({ position, rotation })
    }, throttleMs)
  )
}

/**
 * Subscribe to position updates from other peers.
 * @param session - The active P2P session
 * @param callback - Called with the sender's PlayerState on each update
 * @returns Unsubscribe function
 */
export const p2pOnPlayers = (
  session: P2PSession,
  callback: (player: PlayerState) => void
): (() => void) => {
  const [, onPos] = session.room.makeAction<PositionRecord>('pos')

  onPos((data: PositionRecord, peerId: string) => {
    console.warn(`[p2p] received position from ${peerId}`, data)
    const pos = data['position'] as PlayerPosition
    const rot = data['rotation'] as PlayerRotation
    callback({ id: peerId, position: pos, rotation: rot })
  })

  return () => {}
}

/**
 * Broadcast a named animation action to all peers.
 * @param session - The active P2P session
 * @param actionName - Animation clip name to play (e.g. "wave", "attack")
 */
export const p2pSendAction = (session: P2PSession, actionName: string): void => {
  const [sendAction] = session.room.makeAction<ActionRecord>('action')
  console.warn(`[p2p] sending action: ${actionName}`)
  sendAction({ name: actionName })
}

/**
 * Subscribe to animation action broadcasts from other peers.
 * @param session - The active P2P session
 * @param callback - Called with the sender's peer ID and action name
 * @returns Unsubscribe function
 */
export const p2pOnAction = (
  session: P2PSession,
  callback: (peerId: string, action: PlayerAction) => void
): (() => void) => {
  const [, onAction] = session.room.makeAction<ActionRecord>('action')
  onAction((data: ActionRecord, peerId: string) => {
    console.warn(`[p2p] received action from ${peerId}:`, data)
    callback(peerId, data as PlayerAction)
  })
  return () => {}
}
