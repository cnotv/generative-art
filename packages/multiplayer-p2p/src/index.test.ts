import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PlayerState } from './types'

// ── Mock trystero/nostr ────────────────────────────────────────────────────
type ActionCallback<T> = (data: T, peerId: string) => void

const mockSend = vi.fn()
const mockLeave = vi.fn()
const mockOnPeerJoin = vi.fn()
const mockOnPeerLeave = vi.fn()
const mockGetPeers = vi.fn(() => [] as string[])

const actionCallbacks = new Map<string, ActionCallback<unknown>>()

const mockRoom = {
  makeAction: vi.fn(<T>(channel: string): [typeof mockSend, ActionCallback<T>] => {
    return [
      mockSend,
      (callback: ActionCallback<T>) => {
        actionCallbacks.set(channel, callback as ActionCallback<unknown>)
      }
    ]
  }),
  leave: mockLeave,
  onPeerJoin: mockOnPeerJoin,
  onPeerLeave: mockOnPeerLeave,
  getPeers: mockGetPeers
}

vi.mock('trystero/nostr', () => ({
  joinRoom: vi.fn(() => mockRoom)
}))

import { p2pJoin, p2pLeave, p2pSendPosition, p2pOnPlayers, p2pSendData, p2pOnData } from './index'

describe('p2pJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
  })

  it('returns a session with room and destroy function', async () => {
    const session = p2pJoin('room-1')
    expect(session).toHaveProperty('room')
    expect(session).toHaveProperty('destroy')
    expect(typeof session.destroy).toBe('function')
  })

  it('calls joinRoom with the provided roomId and default appId', async () => {
    const { joinRoom } = await import('trystero/nostr')
    p2pJoin('level-abc')
    expect(joinRoom).toHaveBeenCalledWith({ appId: 'webgamekit' }, 'level-abc')
  })

  it('uses custom appId from config', async () => {
    const { joinRoom } = await import('trystero/nostr')
    p2pJoin('room-2', { appId: 'my-game' })
    expect(joinRoom).toHaveBeenCalledWith({ appId: 'my-game' }, 'room-2')
  })
})

describe('p2pLeave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
  })

  it('calls room.leave()', () => {
    const session = p2pJoin('room-1')
    p2pLeave(session)
    expect(mockLeave).toHaveBeenCalled()
  })

  it('session.destroy() also calls room.leave()', () => {
    const session = p2pJoin('room-1')
    session.destroy()
    expect(mockLeave).toHaveBeenCalled()
  })
})

describe('p2pSendPosition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    actionCallbacks.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends position and rotation via the pos action', () => {
    const session = p2pJoin('room-1')
    const position = { x: 1, y: 2, z: 3 }
    const rotation = { x: 0, y: 0.5, z: 0 }
    p2pSendPosition(session, position, rotation)
    vi.advanceTimersByTime(30)
    expect(mockSend).toHaveBeenCalledWith({ position, rotation })
  })

  it('throttles rapid calls — only one send per interval', () => {
    const session = p2pJoin('room-1')
    const rotation = { x: 0, y: 0, z: 0 }
    p2pSendPosition(session, { x: 1, y: 0, z: 0 }, rotation)
    p2pSendPosition(session, { x: 2, y: 0, z: 0 }, rotation)
    p2pSendPosition(session, { x: 3, y: 0, z: 0 }, rotation)
    vi.advanceTimersByTime(30)
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('respects custom throttleMs', () => {
    const session = p2pJoin('room-1')
    const position = { x: 5, y: 0, z: 0 }
    p2pSendPosition(session, position, { x: 0, y: 0, z: 0 }, { throttleMs: 100 })
    vi.advanceTimersByTime(50)
    expect(mockSend).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ position }))
  })
})

describe('p2pOnPlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
  })

  it('calls callback when position data arrives from a peer', () => {
    const session = p2pJoin('room-1')
    const callback = vi.fn()
    p2pOnPlayers(session, callback)

    const onPos = actionCallbacks.get('pos') as ActionCallback<{
      position: PlayerState['position']
      rotation: PlayerState['rotation']
    }>
    onPos?.({ position: { x: 5, y: 0, z: 3 }, rotation: { x: 0, y: 1, z: 0 } }, 'peer-42')

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'peer-42', position: { x: 5, y: 0, z: 3 } })
    )
  })

  it('returns an unsubscribe function', () => {
    const session = p2pJoin('room-1')
    const unsubscribe = p2pOnPlayers(session, vi.fn())
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })
})

describe('p2pSendData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
  })

  it('sends typed payload on the given channel', () => {
    const session = p2pJoin('room-1')
    p2pSendData(session, 'coin:collected', { coinId: 'c1' })
    expect(mockSend).toHaveBeenCalledWith({ coinId: 'c1' })
  })

  it('supports any serializable payload', () => {
    const session = p2pJoin('room-1')
    p2pSendData(session, 'game:event', { type: 'levelUp', score: 100 })
    expect(mockSend).toHaveBeenCalledWith({ type: 'levelUp', score: 100 })
  })
})

describe('p2pOnData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
  })

  it('calls callback with typed payload and sender peerId', () => {
    const session = p2pJoin('room-1')
    const callback = vi.fn()
    p2pOnData<{ coinId: string }>(session, 'coin:collected', callback)

    const onChannel = actionCallbacks.get('coin:collected') as ActionCallback<{ coinId: string }>
    onChannel?.({ coinId: 'c1' }, 'peer-7')

    expect(callback).toHaveBeenCalledWith({ coinId: 'c1' }, 'peer-7')
  })

  it('returns an unsubscribe function', () => {
    const session = p2pJoin('room-1')
    const unsubscribe = p2pOnData(session, 'game:event', vi.fn())
    expect(typeof unsubscribe).toBe('function')
  })
})
