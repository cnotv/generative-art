import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWordRunnerStore } from './wordRunner'

const join = (store: ReturnType<typeof useWordRunnerStore>, id: string, name: string): void =>
  store.upsertPlayer({ id, name, color: '#a0c4ff' })

describe('useWordRunnerStore', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts in the lobby with no one in the room', () => {
    const store = useWordRunnerStore()

    expect(store.phase).toBe('lobby')
    expect(store.playerList).toEqual([])
    expect(store.hostId).toBe('')
  })

  it('makes the first player to join the host', () => {
    const store = useWordRunnerStore()

    join(store, 'peer-b', 'Calm Heron')
    join(store, 'peer-a', 'Quick Otter')

    expect(store.hostId).toBe('peer-b')
  })

  it('keeps a player on the start line until their progress arrives', () => {
    const store = useWordRunnerStore()
    join(store, 'peer-a', 'Quick Otter')

    expect(store.players['peer-a']).toMatchObject({
      distance: 0,
      lateral: 0,
      finishSeconds: null,
      ready: false
    })
  })

  it('records progress and the finish, and orders the room by distance', () => {
    const store = useWordRunnerStore()
    join(store, 'peer-a', 'Quick Otter')
    join(store, 'peer-b', 'Calm Heron')

    store.setProgress('peer-a', 120, 3.6)
    store.setProgress('peer-b', 300, -3.6)
    store.setFinish('peer-b', 61.5)

    expect(store.playerList.map((player) => player.id)).toEqual(['peer-b', 'peer-a'])
    expect(store.players['peer-a']).toMatchObject({ distance: 120, lateral: 3.6 })
    expect(store.players['peer-b'].finishSeconds).toBe(61.5)
  })

  it('puts everyone back on the start line, not ready, for a new race', () => {
    const store = useWordRunnerStore()
    join(store, 'peer-a', 'Quick Otter')
    store.setProgress('peer-a', 120, 3.6)
    store.setFinish('peer-a', 50)
    store.setReady('peer-a')

    store.startRace('de-a1', 'extreme')

    expect(store.phase).toBe('race')
    expect(store.levelId).toBe('de-a1')
    expect(store.difficulty).toBe('extreme')
    expect(store.players['peer-a']).toMatchObject({
      distance: 0,
      lateral: 0,
      finishSeconds: null,
      ready: false
    })
  })

  it('counts every race, so the same level raced again is a new race, not yet started', () => {
    const store = useWordRunnerStore()
    store.startRace('de-a1', 'normal')
    store.markStarted()

    store.startRace('de-a1', 'normal')

    expect(store.raceSerial).toBe(2)
    expect(store.started).toBe(false)
  })

  it('knows when every player in the room has loaded the course', () => {
    const store = useWordRunnerStore()
    join(store, 'peer-a', 'Quick Otter')
    join(store, 'peer-b', 'Calm Heron')

    store.setReady('peer-a')
    expect(store.everyoneReady).toBe(false)

    store.setReady('peer-b')
    expect(store.everyoneReady).toBe(true)
  })

  it('ignores progress from a player who has left', () => {
    const store = useWordRunnerStore()
    join(store, 'peer-a', 'Quick Otter')
    store.removePlayer('peer-a')

    store.setProgress('peer-a', 99, 0)

    expect(store.players['peer-a']).toBeUndefined()
  })
})
