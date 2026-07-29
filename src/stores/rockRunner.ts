import { defineStore } from 'pinia'
import { DEFAULT_ROCK_SURFACE } from '@/views/Games/RockRunner/elements/rockSurfaces'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { RrPlayer, RrPhase } from '@/views/Games/RockRunner/types'

export const useRockRunnerStore = defineStore('rockRunner', () => {
  const players = ref<Record<string, RrPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<RrPhase>('lobby')
  const solo = ref(false)
  const runStartTime = ref<number | null>(null)
  const trackSeed = ref(1)
  const rockSurface = ref(DEFAULT_ROCK_SURFACE)

  const playerList = computed(() =>
    Object.values(players.value).sort((a, b) => b.distance - a.distance)
  )

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    return ids.length > 0 ? ids[0] : ''
  })

  const upsertPlayer = (player: RrPlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([pid]) => pid !== id))
  }

  const setDistance = (id: string, distance: number): void => {
    const player = players.value[id]
    if (!player) return
    upsertPlayer({ ...player, distance })
  }

  const clearDistances = (): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).map(([id, player]) => [id, { ...player, distance: 0 }])
    )
  }

  const appendMessage = (message: ChatMessage): void => {
    messages.value = [...messages.value, message].slice(-200)
  }

  const reset = (): void => {
    players.value = {}
    messages.value = []
    phase.value = 'lobby'
    solo.value = false
    runStartTime.value = null
    trackSeed.value = 1
  }

  return {
    rockSurface,
    players,
    messages,
    phase,
    solo,
    runStartTime,
    trackSeed,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    setDistance,
    clearDistances,
    appendMessage,
    reset
  }
})
