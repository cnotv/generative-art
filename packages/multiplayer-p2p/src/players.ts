import type {
  PlayerPosition,
  PlayerRotation,
  PlayerState,
  PlayerAction,
  P2PConfig,
  P2PSession
} from './types'

type PositionRecord = Record<string, Record<string, number>>

const defaultThrottleMs = 30

const pendingTimers = new WeakMap<P2PSession, ReturnType<typeof setTimeout>>()
const lastSentAt = new WeakMap<P2PSession, number>()

type SendFunction = (data: unknown) => void
type ReceiveFunction = (callback: (data: unknown, peerId: string) => void) => void

const sendCache = new WeakMap<P2PSession, Map<string, SendFunction>>()
const recvRegistered = new WeakMap<P2PSession, Set<string>>()

const getSend = (session: P2PSession, channel: string): SendFunction => {
  if (!sendCache.has(session)) sendCache.set(session, new Map())
  const cache = sendCache.get(session)!
  if (!cache.has(channel)) {
    const [send] = session.room.makeAction(channel)
    cache.set(channel, send as SendFunction)
  }
  return cache.get(channel)!
}

const getRecv = (session: P2PSession, channel: string): ReceiveFunction | null => {
  if (!recvRegistered.has(session)) recvRegistered.set(session, new Set())
  const registered = recvRegistered.get(session)!
  if (registered.has(channel)) return null
  registered.add(channel)
  const [, onReceive] = session.room.makeAction(channel)
  return onReceive as ReceiveFunction
}

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
  const sendPos = getSend(session, 'pos')
  const now = performance.now()
  const last = lastSentAt.get(session) ?? 0

  const doSend = (): void => {
    lastSentAt.set(session, performance.now())
    sendPos({ position, rotation })
  }

  if (now - last >= throttleMs) {
    const existing = pendingTimers.get(session)
    if (existing !== undefined) clearTimeout(existing)
    doSend()
  } else {
    const existing = pendingTimers.get(session)
    if (existing !== undefined) clearTimeout(existing)
    pendingTimers.set(
      session,
      setTimeout(
        () => {
          pendingTimers.delete(session)
          doSend()
        },
        throttleMs - (now - last)
      )
    )
  }
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
  const onPos = getRecv(session, 'pos')
  if (onPos) {
    onPos((data: unknown, peerId: string) => {
      const record = data as PositionRecord
      const pos = record['position'] as PlayerPosition
      const rot = record['rotation'] as PlayerRotation
      callback({ id: peerId, position: pos, rotation: rot })
    })
  }

  return () => {}
}

/**
 * Broadcast a named animation action to all peers.
 * @param session - The active P2P session
 * @param actionName - Animation clip name to play (e.g. "wave", "attack")
 */
export const p2pSendAction = (session: P2PSession, actionName: string): void => {
  const sendAction = getSend(session, 'action')
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
  const onAction = getRecv(session, 'action')
  if (onAction) {
    onAction((data: unknown, peerId: string) => {
      callback(peerId, data as PlayerAction)
    })
  }
  return () => {}
}
