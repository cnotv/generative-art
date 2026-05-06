import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PlayerState } from './types'

// ── Mock trystero/nostr ────────────────────────────────────────────────────
type ActionCallback<T> = (data: T, peerId: string) => void

const mockSend = vi.fn()
const mockLeave = vi.fn()
const mockGetPeers = vi.fn(() => [] as string[])

const actionCallbacks = new Map<string, ActionCallback<unknown>>()
const peerJoinCallbacks: ((peerId: string) => void)[] = []
const peerLeaveCallbacks: ((peerId: string) => void)[] = []

const simulatePeerJoin = (peerId: string) =>
  peerJoinCallbacks.forEach((callback) => callback(peerId))
const simulatePeerLeave = (peerId: string) =>
  peerLeaveCallbacks.forEach((callback) => callback(peerId))

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
  onPeerJoin: (callback: (peerId: string) => void) => peerJoinCallbacks.push(callback),
  onPeerLeave: (callback: (peerId: string) => void) => peerLeaveCallbacks.push(callback),
  getPeers: mockGetPeers
}

vi.mock('trystero/nostr', () => ({
  selfId: 'local-peer',
  joinRoom: vi.fn(() => mockRoom)
}))

import {
  p2pJoin,
  p2pLeave,
  p2pSendPosition,
  p2pOnPlayers,
  p2pSendData,
  p2pOnData,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pMatchmake
} from './index'

describe('p2pJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
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
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
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

describe('p2pOnPeerJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
  })

  it('calls callback with peer ID when a peer joins', () => {
    const session = p2pJoin('room-1')
    const callback = vi.fn()
    p2pOnPeerJoin(session, callback)
    simulatePeerJoin('peer-abc')
    expect(callback).toHaveBeenCalledWith('peer-abc')
  })

  it('supports multiple join callbacks', () => {
    const session = p2pJoin('room-1')
    const callbackA = vi.fn()
    const callbackB = vi.fn()
    p2pOnPeerJoin(session, callbackA)
    p2pOnPeerJoin(session, callbackB)
    simulatePeerJoin('peer-xyz')
    expect(callbackA).toHaveBeenCalledWith('peer-xyz')
    expect(callbackB).toHaveBeenCalledWith('peer-xyz')
  })
})

describe('p2pOnPeerLeave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
  })

  it('calls callback with peer ID when a peer leaves', () => {
    const session = p2pJoin('room-1')
    const callback = vi.fn()
    p2pOnPeerLeave(session, callback)
    simulatePeerLeave('peer-abc')
    expect(callback).toHaveBeenCalledWith('peer-abc')
  })
})

describe('p2pSendPosition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    actionCallbacks.clear()
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
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

describe('p2pMatchmake', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
    mockGetPeers.mockReturnValue({})
  })

  it('calls onStatusChange with searching immediately when no peers present', () => {
    const onStatusChange = vi.fn()
    p2pMatchmake('room-1', undefined, onStatusChange)
    expect(onStatusChange).toHaveBeenCalledWith('searching', 0)
  })

  it('calls onStatusChange with matched immediately when peers already present', () => {
    mockGetPeers.mockReturnValue({ 'peer-existing': {} })
    const onStatusChange = vi.fn()
    p2pMatchmake('room-1', undefined, onStatusChange)
    expect(onStatusChange).toHaveBeenCalledWith('matched', 1)
  })

  it.each([
    ['peer-a', 'matched', 1],
    ['peer-b', 'matched', 1]
  ])('transitions to matched when peer %s joins', (peerId, expectedStatus, expectedCount) => {
    const onStatusChange = vi.fn()
    p2pMatchmake('room-1', undefined, onStatusChange)
    simulatePeerJoin(peerId)
    expect(onStatusChange).toHaveBeenLastCalledWith(expectedStatus, expectedCount)
  })

  it('reverts to searching when last peer leaves', () => {
    const onStatusChange = vi.fn()
    p2pMatchmake('room-1', undefined, onStatusChange)
    simulatePeerJoin('peer-a')
    simulatePeerLeave('peer-a')
    expect(onStatusChange).toHaveBeenLastCalledWith('searching', 0)
  })

  it('stays matched when one of multiple peers leaves', () => {
    const onStatusChange = vi.fn()
    p2pMatchmake('room-1', undefined, onStatusChange)
    simulatePeerJoin('peer-a')
    simulatePeerJoin('peer-b')
    simulatePeerLeave('peer-a')
    expect(onStatusChange).toHaveBeenLastCalledWith('matched', 1)
  })

  it('returns a session with the correct peerId', () => {
    const { session } = p2pMatchmake('room-1', undefined, vi.fn())
    expect(session.peerId).toBe('local-peer')
  })

  it('stop() calls p2pLeave and cleans up the room', () => {
    const { stop } = p2pMatchmake('room-1', undefined, vi.fn())
    stop()
    expect(mockLeave).toHaveBeenCalled()
  })

  it('tracks multiple peers correctly by ID', () => {
    const onStatusChange = vi.fn()
    p2pMatchmake('room-1', undefined, onStatusChange)
    simulatePeerJoin('peer-a')
    simulatePeerJoin('peer-b')
    simulatePeerLeave('peer-b')
    expect(onStatusChange).toHaveBeenLastCalledWith('matched', 1)
    simulatePeerLeave('peer-a')
    expect(onStatusChange).toHaveBeenLastCalledWith('searching', 0)
  })
})

// ── Lobby helpers ──────────────────────────────────────────────────────────
// In the mock, actionCallbacks stores the *receive* side of makeAction by channel.
// We expose two helpers to simulate incoming lobby messages.
const fireLobbyRequest = (payload: { requestId: string; gameRoomId: string }, fromPeerId: string) =>
  (actionCallbacks.get('lobby-req') as ((d: unknown, p: string) => void) | undefined)?.(
    payload,
    fromPeerId
  )

const fireLobbyResponse = (payload: { requestId: string; accepted: string }) =>
  (actionCallbacks.get('lobby-res') as ((d: unknown, p: string) => void) | undefined)?.(
    payload,
    'some-peer'
  )

const fireLobbyName = (payload: { name: string }, fromPeerId: string) =>
  (actionCallbacks.get('lobby-name') as ((d: unknown, p: string) => void) | undefined)?.(
    payload,
    fromPeerId
  )

import { p2pLobbyJoin } from './index'

describe('p2pLobbyJoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    actionCallbacks.clear()
    peerJoinCallbacks.length = 0
    peerLeaveCallbacks.length = 0
    mockGetPeers.mockReturnValue({})
  })

  it('returns a handle with session, getPeerIds, setName, sendRequest, acceptRequest, ignoreRequest, stop', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    expect(typeof handle.session).toBe('object')
    expect(typeof handle.getPeerIds).toBe('function')
    expect(typeof handle.setName).toBe('function')
    expect(typeof handle.sendRequest).toBe('function')
    expect(typeof handle.acceptRequest).toBe('function')
    expect(typeof handle.ignoreRequest).toBe('function')
    expect(typeof handle.stop).toBe('function')
  })

  it('calls onPeerJoin when a peer joins the lobby', () => {
    const onPeerJoin = vi.fn()
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin,
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    simulatePeerJoin('peer-a')
    expect(onPeerJoin).toHaveBeenCalledWith('peer-a')
  })

  it('calls onPeerLeave when a peer leaves the lobby', () => {
    const onPeerLeave = vi.fn()
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave,
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    simulatePeerLeave('peer-a')
    expect(onPeerLeave).toHaveBeenCalledWith('peer-a')
  })

  it('calls onRequest when a match request arrives', () => {
    const onRequest = vi.fn()
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest,
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    fireLobbyRequest({ requestId: 'req-1', gameRoomId: 'room-abc' }, 'peer-b')
    expect(onRequest).toHaveBeenCalledWith({ requestId: 'req-1', gameRoomId: 'room-abc' }, 'peer-b')
  })

  it('calls onAccepted with requestId when acceptance response arrives', () => {
    const onAccepted = vi.fn()
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted,
      onIgnored: vi.fn()
    })
    fireLobbyResponse({ requestId: 'req-1', accepted: 'true' })
    expect(onAccepted).toHaveBeenCalledWith('req-1')
  })

  it('calls onIgnored with requestId when ignore response arrives', () => {
    const onIgnored = vi.fn()
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored
    })
    fireLobbyResponse({ requestId: 'req-2', accepted: 'false' })
    expect(onIgnored).toHaveBeenCalledWith('req-2')
  })

  it('sendRequest sends payload to target peer and returns a MatchRequest', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    const request = handle.sendRequest('peer-b')
    expect(request).toHaveProperty('requestId')
    expect(request).toHaveProperty('gameRoomId')
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: request.requestId, gameRoomId: request.gameRoomId }),
      'peer-b'
    )
  })

  it('acceptRequest sends accepted=true response to the requester', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    handle.acceptRequest({ requestId: 'req-1', gameRoomId: 'room-x' }, 'peer-b')
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-1', accepted: 'true' }),
      'peer-b'
    )
  })

  it('ignoreRequest sends accepted=false response to the requester', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    handle.ignoreRequest({ requestId: 'req-2', gameRoomId: 'room-y' }, 'peer-c')
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-2', accepted: 'false' }),
      'peer-c'
    )
  })

  it('stop() leaves the room', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    handle.stop()
    expect(mockLeave).toHaveBeenCalled()
  })

  it('setName() broadcasts name to all peers', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    handle.setName('Alice')
    expect(mockSend).toHaveBeenCalledWith({ name: 'Alice' })
  })

  it('onPeerName is called when a peer broadcasts their name', () => {
    const onPeerName = vi.fn()
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName
    })
    fireLobbyName({ name: 'Bob' }, 'peer-b')
    expect(onPeerName).toHaveBeenCalledWith('peer-b', 'Bob')
  })

  it('auto-sends name to a peer that joins after setName was called', () => {
    const handle = p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    handle.setName('Alice')
    vi.clearAllMocks()
    simulatePeerJoin('peer-late')
    expect(mockSend).toHaveBeenCalledWith({ name: 'Alice' }, 'peer-late')
  })

  it('does not send name on peer join when no name has been set', () => {
    p2pLobbyJoin('lobby-1', undefined, {
      onPeerJoin: vi.fn(),
      onPeerLeave: vi.fn(),
      onRequest: vi.fn(),
      onAccepted: vi.fn(),
      onIgnored: vi.fn(),
      onPeerName: vi.fn()
    })
    simulatePeerJoin('peer-a')
    expect(mockSend).not.toHaveBeenCalledWith(expect.objectContaining({ name: expect.any(String) }))
  })
})
