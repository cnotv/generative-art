import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PlayerState } from './types'

// ── Mock socket.io-client ──────────────────────────────────────────────────
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

const emit = (event: string, ...args: unknown[]) =>
  mockListeners.get(event)?.forEach((callback) => callback(...args))

vi.mock('socket.io-client', () => ({ io: vi.fn(() => mockSocket) }))

// ── Import after mock ──────────────────────────────────────────────────────
import {
  multiplayerClientCreate,
  multiplayerClientDestroy,
  multiplayerClientSendPosition,
  multiplayerClientOnPlayers,
  multiplayerClientSendData,
  multiplayerClientOnData
} from './index'

describe('multiplayerClientCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('returns a session with a socket and destroy function', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    expect(session).toHaveProperty('socket')
    expect(session).toHaveProperty('destroy')
    expect(typeof session.destroy).toBe('function')
  })

  it('connects to the provided URL', async () => {
    const { io } = await import('socket.io-client')
    multiplayerClientCreate('http://example.com:4000')
    expect(io).toHaveBeenCalledWith('http://example.com:4000')
  })
})

describe('multiplayerClientDestroy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls disconnect on the socket', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    multiplayerClientDestroy(session)
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('session.destroy() also disconnects', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    session.destroy()
    expect(mockSocket.disconnect).toHaveBeenCalled()
  })
})

describe('multiplayerClientSendPosition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits user:updated with position and rotation', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const position = { x: 1, y: 2, z: 3 }
    const rotation = { x: 0, y: 0.5, z: 0 }
    multiplayerClientSendPosition(session, position, rotation)
    vi.advanceTimersByTime(30)
    expect(mockSocket.emit).toHaveBeenCalledWith('user:updated', { position, rotation })
  })

  it('throttles rapid calls — only one emission per interval', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const rotation = { x: 0, y: 0, z: 0 }
    multiplayerClientSendPosition(session, { x: 1, y: 0, z: 0 }, rotation)
    multiplayerClientSendPosition(session, { x: 2, y: 0, z: 0 }, rotation)
    multiplayerClientSendPosition(session, { x: 3, y: 0, z: 0 }, rotation)
    vi.advanceTimersByTime(30)
    const calls = mockEmitted.filter(([e]) => e === 'user:updated')
    expect(calls.length).toBe(1)
  })

  it('respects custom throttleMs from config', () => {
    const session = multiplayerClientCreate('http://localhost:3000', { throttleMs: 100 })
    const position = { x: 1, y: 0, z: 0 }
    const rotation = { x: 0, y: 0, z: 0 }
    multiplayerClientSendPosition(session, position, rotation)
    vi.advanceTimersByTime(30)
    expect(mockSocket.emit).not.toHaveBeenCalledWith('user:updated', expect.anything())
    vi.advanceTimersByTime(70)
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'user:updated',
      expect.objectContaining({ position })
    )
  })
})

describe('multiplayerClientOnPlayers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls callback when user:list is received', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const callback = vi.fn()
    const players: PlayerState[] = [
      { id: 'abc', name: 'Alice', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    ]
    multiplayerClientOnPlayers(session, callback)
    emit('user:list', players)
    expect(callback).toHaveBeenCalledWith(players)
  })

  it('returns an unsubscribe function', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const unsubscribe = multiplayerClientOnPlayers(session, vi.fn())
    unsubscribe()
    expect(mockSocket.off).toHaveBeenCalledWith('user:list', expect.any(Function))
  })
})

describe('multiplayerClientSendData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('emits typed data on the given channel', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    multiplayerClientSendData(session, 'coin:collected', { coinId: 'c1', playerId: 'p1' })
    expect(mockSocket.emit).toHaveBeenCalledWith('coin:collected', { coinId: 'c1', playerId: 'p1' })
  })

  it('works with any serializable payload type', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    multiplayerClientSendData(session, 'game:event', { type: 'levelUp', level: 5 })
    expect(mockSocket.emit).toHaveBeenCalledWith('game:event', { type: 'levelUp', level: 5 })
  })
})

describe('multiplayerClientOnData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListeners.clear()
    mockEmitted.length = 0
  })

  it('calls callback with typed payload when server sends data', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const callback = vi.fn()
    multiplayerClientOnData<{ coinId: string }>(session, 'coin:collected', callback)
    emit('coin:collected', { coinId: 'c1' })
    expect(callback).toHaveBeenCalledWith({ coinId: 'c1' })
  })

  it('returns an unsubscribe function', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const unsubscribe = multiplayerClientOnData(session, 'coin:collected', vi.fn())
    unsubscribe()
    expect(mockSocket.off).toHaveBeenCalledWith('coin:collected', expect.any(Function))
  })

  it('supports multiple independent channels', () => {
    const session = multiplayerClientCreate('http://localhost:3000')
    const onCoin = vi.fn()
    const onChat = vi.fn()
    multiplayerClientOnData(session, 'coin:collected', onCoin)
    multiplayerClientOnData(session, 'chat:message', onChat)
    emit('coin:collected', { coinId: 'c2' })
    emit('chat:message', { text: 'hello' })
    expect(onCoin).toHaveBeenCalledWith({ coinId: 'c2' })
    expect(onChat).toHaveBeenCalledWith({ text: 'hello' })
  })
})
