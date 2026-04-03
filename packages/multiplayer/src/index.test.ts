import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Socket } from 'socket.io-client'
import type { PlayerState, CoinState, CoinCollectedEvent } from './types'

// ── Mock socket.io-client ────────────────────────────────────────────────────
const mockListeners = new Map<string, ((...args: unknown[]) => void)[]>()
const mockEmitted: Array<[string, unknown]> = []

const mockSocket = {
  connected: false,
  on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
    if (!mockListeners.has(event)) mockListeners.set(event, [])
    mockListeners.get(event)!.push(callback)
  }),
  off: vi.fn(),
  emit: vi.fn((event: string, data: unknown) => {
    mockEmitted.push([event, data])
  }),
  disconnect: vi.fn()
}

const emit = (event: string, ...args: unknown[]) => {
  mockListeners.get(event)?.forEach((callback) => callback(...args))
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}))

// ── Import after mock ────────────────────────────────────────────────────────
import {
  multiplayerCreate,
  multiplayerDestroy,
  multiplayerSendPosition,
  multiplayerOnPlayers,
  multiplayerCollectCoin,
  multiplayerOnCoinCollected,
  multiplayerOnCoinsSync
} from './index'

describe('multiplayerCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('returns a session with a socket and destroy function', () => {
    const session = multiplayerCreate('http://localhost:3000')
    expect(session).toHaveProperty('socket')
    expect(session).toHaveProperty('destroy')
    expect(typeof session.destroy).toBe('function')
  })

  it('connects to the provided URL', async () => {
    const { io } = await import('socket.io-client')
    multiplayerCreate('http://example.com:4000')
    expect(io).toHaveBeenCalledWith('http://example.com:4000')
  })
})

describe('multiplayerDestroy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls disconnect on the socket', () => {
    const session = multiplayerCreate('http://localhost:3000')
    multiplayerDestroy(session)
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('destroy method on session also disconnects', () => {
    const session = multiplayerCreate('http://localhost:3000')
    session.destroy()
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })
})

describe('multiplayerSendPosition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits user:updated event with position and rotation', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const position = { x: 1, y: 2, z: 3 }
    const rotation = { x: 0, y: 0.5, z: 0 }

    multiplayerSendPosition(session, position, rotation)
    vi.advanceTimersByTime(30)

    expect(mockSocket.emit).toHaveBeenCalledWith('user:updated', { position, rotation })
  })

  it('throttles rapid calls to one emission per interval', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const position = { x: 1, y: 0, z: 0 }
    const rotation = { x: 0, y: 0, z: 0 }

    multiplayerSendPosition(session, position, rotation)
    multiplayerSendPosition(session, { x: 2, y: 0, z: 0 }, rotation)
    multiplayerSendPosition(session, { x: 3, y: 0, z: 0 }, rotation)
    vi.advanceTimersByTime(30)

    const userUpdatedCalls = mockEmitted.filter(([event]) => event === 'user:updated')
    expect(userUpdatedCalls.length).toBe(1)
  })

  it('respects custom throttleMs from config', () => {
    const session = multiplayerCreate('http://localhost:3000', { throttleMs: 100 })
    const position = { x: 1, y: 0, z: 0 }
    const rotation = { x: 0, y: 0, z: 0 }

    multiplayerSendPosition(session, position, rotation)
    vi.advanceTimersByTime(30) // Not enough
    expect(mockSocket.emit).not.toHaveBeenCalledWith('user:updated', expect.anything())

    vi.advanceTimersByTime(70) // Now 100ms total
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'user:updated',
      expect.objectContaining({ position })
    )
  })
})

describe('multiplayerOnPlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls the callback when user:list is received', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const callback = vi.fn()
    const players: PlayerState[] = [
      { id: 'abc', name: 'Alice', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]

    multiplayerOnPlayers(session, callback)
    emit('user:list', players)

    expect(callback).toHaveBeenCalledWith(players)
  })

  it('returns an unsubscribe function', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const callback = vi.fn()

    const unsubscribe = multiplayerOnPlayers(session, callback)
    unsubscribe()

    expect(mockSocket.off).toHaveBeenCalledWith('user:list', expect.any(Function))
  })
})

describe('multiplayerCollectCoin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('emits coin:collected with the coinId', () => {
    const session = multiplayerCreate('http://localhost:3000')
    multiplayerCollectCoin(session, 'coin-42')
    expect(mockSocket.emit).toHaveBeenCalledWith('coin:collected', { coinId: 'coin-42' })
  })
})

describe('multiplayerOnCoinCollected', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls callback with CoinCollectedEvent when server broadcasts', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const callback = vi.fn()
    const event: CoinCollectedEvent = { coinId: 'coin-42', playerId: 'player-1' }

    multiplayerOnCoinCollected(session, callback)
    emit('coin:collected', event)

    expect(callback).toHaveBeenCalledWith(event)
  })

  it('returns an unsubscribe function', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const callback = vi.fn()

    const unsubscribe = multiplayerOnCoinCollected(session, callback)
    unsubscribe()

    expect(mockSocket.off).toHaveBeenCalledWith('coin:collected', expect.any(Function))
  })
})

describe('multiplayerOnCoinsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls callback with initial coin list from server', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const callback = vi.fn()
    const coins: CoinState[] = [
      { id: 'coin-1', position: { x: 0, y: 1, z: 0 }, collected: false },
      { id: 'coin-2', position: { x: 5, y: 1, z: 5 }, collected: true }
    ]

    multiplayerOnCoinsSync(session, callback)
    emit('coin:list', coins)

    expect(callback).toHaveBeenCalledWith(coins)
  })

  it('returns an unsubscribe function', () => {
    const session = multiplayerCreate('http://localhost:3000')
    const callback = vi.fn()

    const unsubscribe = multiplayerOnCoinsSync(session, callback)
    unsubscribe()

    expect(mockSocket.off).toHaveBeenCalledWith('coin:list', expect.any(Function))
  })
})

// ── Integration: socket typed as Socket for type safety ──────────────────────
describe('session.socket type', () => {
  it('exposes the underlying socket.io Socket', () => {
    const session = multiplayerCreate('http://localhost:3000')
    // TypeScript ensures this compiles — cast for runtime check
    const socket = session.socket as unknown as Socket
    expect(socket).toBeDefined()
  })
})
