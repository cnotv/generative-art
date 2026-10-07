import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { WrPhase, WrPlayer } from '@/views/Games/WordRunner/types'

const START_LANE = 1
const MAX_MESSAGES = 200

/** A player as they stand on the start line, before any of their race has arrived. */
const onStartLine = (player: Pick<WrPlayer, 'id' | 'name' | 'color'>): WrPlayer => ({
  ...player,
  distance: 0,
  lane: START_LANE,
  finishSeconds: null,
  ready: false
})

export const useWordRunnerStore = defineStore('wordRunner', () => {
  const players = ref<Record<string, WrPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<WrPhase>('lobby')
  const solo = ref(true)
  const levelId = ref('')
  // Counts races, so racing the same level again still reads as a new race.
  const raceSerial = ref(0)
  // The room has been told to go: every ball may roll.
  const started = ref(false)

  const playerList = computed(() =>
    Object.values(players.value).sort((first, second) => second.distance - first.distance)
  )
  // The first peer to have joined hosts: every peer holds the same insertion order.
  const hostId = computed(() => Object.keys(players.value)[0] ?? '')
  const everyoneReady = computed(() => Object.values(players.value).every((player) => player.ready))

  const upsertPlayer = (player: Pick<WrPlayer, 'id' | 'name' | 'color'>): void => {
    const existing = players.value[player.id]
    players.value = {
      ...players.value,
      [player.id]: existing ? { ...existing, ...player } : onStartLine(player)
    }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).filter(([playerId]) => playerId !== id)
    )
  }

  const updatePlayer = (id: string, change: Partial<WrPlayer>): void => {
    const player = players.value[id]
    if (!player) return
    players.value = { ...players.value, [id]: { ...player, ...change } }
  }

  const setProgress = (id: string, distance: number, lane: number): void =>
    updatePlayer(id, { distance, lane })
  const setFinish = (id: string, finishSeconds: number): void => updatePlayer(id, { finishSeconds })
  const setReady = (id: string): void => updatePlayer(id, { ready: true })

  /** Takes the room into a race of a level, everyone back on the start line. */
  const startRace = (nextLevelId: string): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).map(([id, player]) => [id, onStartLine(player)])
    )
    levelId.value = nextLevelId
    raceSerial.value += 1
    started.value = false
    phase.value = 'race'
  }

  const markStarted = (): void => {
    started.value = true
  }

  const appendMessage = (message: ChatMessage): void => {
    messages.value = [...messages.value, message].slice(-MAX_MESSAGES)
  }

  const reset = (): void => {
    players.value = {}
    messages.value = []
    phase.value = 'lobby'
    solo.value = true
    levelId.value = ''
    started.value = false
  }

  return {
    players,
    messages,
    phase,
    solo,
    levelId,
    raceSerial,
    started,
    playerList,
    hostId,
    everyoneReady,
    upsertPlayer,
    removePlayer,
    setProgress,
    setFinish,
    setReady,
    startRace,
    markStarted,
    appendMessage,
    reset
  }
})
