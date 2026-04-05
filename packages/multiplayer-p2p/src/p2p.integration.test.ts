import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Room simulation ────────────────────────────────────────────────────────
// Simulates two peers joining the same WebRTC room and routing data between
// them, mirroring the real Trystero behaviour:
//  - onPeerJoin fires on existing sessions when a new peer joins
//  - makeAction sends are delivered to all other sessions' receivers
//  - onPeerLeave fires on remaining sessions when a peer leaves

type Receiver = (data: unknown, peerId: string) => void

type PeerState = {
  peerJoinCallbacks: ((id: string) => void)[]
  peerLeaveCallbacks: ((id: string) => void)[]
  receivers: Map<string, Receiver>
}

const rooms = new Map<string, Map<string, PeerState>>()
let nextPeerId = 0

const resetRooms = () => {
  rooms.clear()
  nextPeerId = 0
}

vi.mock('trystero/nostr', () => {
  return {
    get selfId() {
      return 'local-peer'
    },
    joinRoom: vi.fn((_config: unknown, roomId: string) => {
      const peerId = `peer-${nextPeerId++}`

      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map())
      }
      const room = rooms.get(roomId)!

      const state: PeerState = {
        peerJoinCallbacks: [],
        peerLeaveCallbacks: [],
        receivers: new Map()
      }

      // Notify all existing peers that this peer has joined
      room.forEach((existingState) => {
        existingState.peerJoinCallbacks.forEach((callback) => callback(peerId))
      })

      room.set(peerId, state)

      return {
        onPeerJoin: (callback: (id: string) => void) => state.peerJoinCallbacks.push(callback),
        onPeerLeave: (callback: (id: string) => void) => state.peerLeaveCallbacks.push(callback),
        makeAction: (channel: string) => {
          const send = (data: unknown) => {
            room.forEach((otherState, otherId) => {
              if (otherId !== peerId) {
                otherState.receivers.get(channel)?.(data, peerId)
              }
            })
          }
          const onReceive = (callback: Receiver) => {
            state.receivers.set(channel, callback)
          }
          return [send, onReceive, vi.fn()]
        },
        leave: () => {
          room.delete(peerId)
          room.forEach((otherState) => {
            otherState.peerLeaveCallbacks.forEach((callback) => callback(peerId))
          })
        },
        getPeers: () =>
          Object.fromEntries(
            [...room.entries()].filter(([id]) => id !== peerId).map(([id]) => [id, {}])
          )
      }
    })
  }
})

import {
  p2pJoin,
  p2pLeave,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pGetPeerIds,
  p2pSendPosition,
  p2pOnPlayers
} from './index'

describe('P2P room integration — two peers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetRooms()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('peer A sees peer B via p2pGetPeerIds when A joins after B', () => {
    const sessionB = p2pJoin('room-1') // B joins first
    const sessionA = p2pJoin('room-1') // A joins after — onPeerJoin already fired for B

    // A would have missed the onPeerJoin for B, so use p2pGetPeerIds to catch up
    const existingIds = p2pGetPeerIds(sessionA)
    expect(existingIds).toContain(sessionB.peerId === 'local-peer' ? 'peer-0' : sessionB.peerId)
    expect(existingIds.length).toBe(1)
  })

  it('peer A sees peer B when B joins the same room', () => {
    const sessionA = p2pJoin('room-1')
    const onJoin = vi.fn()
    p2pOnPeerJoin(sessionA, onJoin)

    p2pJoin('room-1') // peer B joins

    expect(onJoin).toHaveBeenCalledTimes(1)
    expect(onJoin).toHaveBeenCalledWith(expect.stringContaining('peer-'))
  })

  it('peer A receives the position broadcast by peer B', () => {
    const sessionA = p2pJoin('room-1')
    const onPlayers = vi.fn()
    p2pOnPlayers(sessionA, onPlayers)

    const sessionB = p2pJoin('room-1')
    const position = { x: 3, y: 0, z: 5 }
    const rotation = { x: 0, y: 1, z: 0 }
    p2pSendPosition(sessionB, position, rotation)
    vi.advanceTimersByTime(30)

    expect(onPlayers).toHaveBeenCalledWith(expect.objectContaining({ position, rotation }))
  })

  it('peer A is notified when peer B leaves', () => {
    const sessionA = p2pJoin('room-1')
    const onLeave = vi.fn()
    p2pOnPeerLeave(sessionA, onLeave)

    const sessionB = p2pJoin('room-1')
    p2pLeave(sessionB)

    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('position from peer B includes the correct sender ID', () => {
    const sessionA = p2pJoin('room-1')
    const onPlayers = vi.fn()
    p2pOnPlayers(sessionA, onPlayers)

    const sessionB = p2pJoin('room-1')
    p2pSendPosition(sessionB, { x: 1, y: 0, z: 2 }, { x: 0, y: 0, z: 0 })
    vi.advanceTimersByTime(30)

    const [{ id }] = onPlayers.mock.calls[0] as [{ id: string }]
    expect(id).toMatch(/^peer-/)
  })

  it('peer A does not receive its own position broadcast', () => {
    const sessionA = p2pJoin('room-1')
    const onPlayers = vi.fn()
    p2pOnPlayers(sessionA, onPlayers)

    p2pSendPosition(sessionA, { x: 1, y: 0, z: 2 }, { x: 0, y: 0, z: 0 })
    vi.advanceTimersByTime(30)

    expect(onPlayers).not.toHaveBeenCalled()
  })

  it("three peers: B and C both appear in A's player list", () => {
    const sessionA = p2pJoin('room-1')
    const onPlayers = vi.fn()
    p2pOnPlayers(sessionA, onPlayers)

    const sessionB = p2pJoin('room-1')
    const sessionC = p2pJoin('room-1')

    p2pSendPosition(sessionB, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    p2pSendPosition(sessionC, { x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
    vi.advanceTimersByTime(30)

    expect(onPlayers).toHaveBeenCalledTimes(2)
    const receivedPositions = onPlayers.mock.calls.map(
      ([p]: [{ position: { x: number } }]) => p.position.x
    )
    expect(receivedPositions).toContain(1)
    expect(receivedPositions).toContain(2)
  })
})
