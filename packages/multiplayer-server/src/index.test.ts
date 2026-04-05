import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PlayerState } from './types'
import { multiplayerServerCreate } from './index'

// ── Mock Socket.IO ─────────────────────────────────────────────────────────
type Handler = (...args: unknown[]) => void

const makeSocket = (id: string) => {
  const handlers = new Map<string, Handler>()
  return {
    id,
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, handler)
    }),
    trigger: (event: string, ...args: unknown[]) => {
      handlers.get(event)?.(...args)
    }
  }
}

const makeIo = () => {
  const connectionHandlers: Handler[] = []
  return {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      if (event === 'connection') connectionHandlers.push(handler)
    }),
    off: vi.fn(),
    connect: (socket: ReturnType<typeof makeSocket>) => {
      connectionHandlers.forEach((h) => h(socket))
    }
  }
}

describe('multiplayerServerCreate', () => {
  let io: ReturnType<typeof makeIo>

  beforeEach(() => {
    io = makeIo()
    vi.clearAllMocks()
  })

  it('registers a connection listener on the server', () => {
    multiplayerServerCreate(io as never)
    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function))
  })

  it('broadcasts user:list when a player connects', () => {
    multiplayerServerCreate(io as never)
    const socket = makeSocket('player-1')
    io.connect(socket)
    expect(io.emit).toHaveBeenCalledWith(
      'user:list',
      expect.arrayContaining([expect.objectContaining({ id: 'player-1' })])
    )
  })

  it('updates player state and re-broadcasts on user:updated', () => {
    multiplayerServerCreate(io as never)
    const socket = makeSocket('player-1')
    io.connect(socket)

    const position = { x: 5, y: 0, z: 3 }
    const rotation = { x: 0, y: 1, z: 0 }
    socket.trigger('user:updated', { position, rotation })

    const lastCall = (io.emit as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    const players = lastCall?.[1] as PlayerState[]
    expect(players[0].position).toEqual(position)
    expect(players[0].rotation).toEqual(rotation)
  })

  it('removes player and broadcasts on disconnect', () => {
    multiplayerServerCreate(io as never)
    const socket = makeSocket('player-1')
    io.connect(socket)
    socket.trigger('disconnect')

    const lastCall = (io.emit as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    expect(lastCall?.[1]).toEqual([])
  })

  it('tracks multiple concurrent players', () => {
    multiplayerServerCreate(io as never)
    const s1 = makeSocket('p1')
    const s2 = makeSocket('p2')
    io.connect(s1)
    io.connect(s2)

    const lastCall = (io.emit as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    const players = lastCall?.[1] as PlayerState[]
    expect(players).toHaveLength(2)
  })

  it('calls onConnect config and sends initial data to the new socket', () => {
    const onConnect = vi.fn(() => ({ 'coin:list': [{ id: 'c1' }] }))
    multiplayerServerCreate(io as never, { onConnect })
    const socket = makeSocket('player-1')
    io.connect(socket)

    expect(onConnect).toHaveBeenCalledWith('player-1')
    expect(socket.emit).toHaveBeenCalledWith('coin:list', [{ id: 'c1' }])
  })

  it('cleanup removes the connection listener', () => {
    const { cleanup } = multiplayerServerCreate(io as never)
    cleanup()
    expect(io.off).toHaveBeenCalledWith('connection', expect.any(Function))
  })
})
