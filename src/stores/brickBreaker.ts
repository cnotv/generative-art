import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { BbMatchLength, BbPhase, BbPlayer } from '@/views/Games/BrickBreaker/types'

export const useBrickBreakerStore = defineStore('brickBreaker', () => {
  const players = ref<Record<string, BbPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<BbPhase>('lobby')
  const solo = ref(false)
  const matchLength = ref<BbMatchLength>('endless')

  const playerList = computed(() => Object.values(players.value).sort((a, b) => b.score - a.score))

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    return ids.length > 0 ? ids[0] : ''
  })

  const upsertPlayer = (player: BbPlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([pid]) => pid !== id))
  }

  const setScore = (id: string, score: number): void => {
    const player = players.value[id]
    if (!player) return
    upsertPlayer({ ...player, score })
  }

  const resetScores = (): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).map(([id, player]) => [id, { ...player, score: 0 }])
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
  }

  return {
    players,
    messages,
    phase,
    solo,
    matchLength,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    setScore,
    resetScores,
    appendMessage,
    reset
  }
})
