import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PlayerState } from './types'
import { multiplayerServerCreate, multiplayerServerAttach } from './index'

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

describe('multiplayerServerAttach', () => {
  let io: ReturnType<typeof makeIo>

  beforeEach(() => {
    io = makeIo()
    vi.clearAllMocks()
  })

  it('registers a connection listener on the server', () => {
    multiplayerServerAttach(io as never)
    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function))
  })

  it('broadcasts user:list when a player connects', () => {
    multiplayerServerAttach(io as never)
    const socket = makeSocket('player-1')
    io.connect(socket)
    expect(io.emit).toHaveBeenCalledWith(
      'user:list',
      expect.arrayContaining([expect.objectContaining({ id: 'player-1' })])
    )
  })

  it('updates player state and re-broadcasts on user:updated', () => {
    multiplayerServerAttach(io as never)
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
    multiplayerServerAttach(io as never)
    const socket = makeSocket('player-1')
    io.connect(socket)
    socket.trigger('disconnect')

    const lastCall = (io.emit as ReturnType<typeof vi.fn>).mock.calls.at(-1)
    expect(lastCall?.[1]).toEqual([])
  })

  it('tracks multiple concurrent players', () => {
    multiplayerServerAttach(io as never)
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
    multiplayerServerAttach(io as never, { onConnect })
    const socket = makeSocket('player-1')
    io.connect(socket)

    expect(onConnect).toHaveBeenCalledWith('player-1')
    expect(socket.emit).toHaveBeenCalledWith('coin:list', [{ id: 'c1' }])
  })

  it('cleanup removes the connection listener', () => {
    const { cleanup } = multiplayerServerAttach(io as never)
    cleanup()
    expect(io.off).toHaveBeenCalledWith('connection', expect.any(Function))
  })
})

describe('multiplayerServerCreate', () => {
  it('returns a Socket.IO server and the HTTP server it rides on', () => {
    const { server, httpServer, cleanup } = multiplayerServerCreate()

    expect(server).toBeDefined()
    expect(typeof httpServer.listen).toBe('function')
    cleanup()
  })

  it('accepts connections once the HTTP server is listening', async () => {
    const { httpServer, cleanup } = multiplayerServerCreate()

    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const address = httpServer.address()

    expect(address).not.toBeNull()
    expect(typeof address === 'object' && address?.port).toBeGreaterThan(0)
    cleanup()
  })

  it('registers the connection handler on the server it created', () => {
    const { server, cleanup } = multiplayerServerCreate()

    expect(server.listenerCount('connection')).toBe(1)
    cleanup()
  })
})
