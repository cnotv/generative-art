import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { MePlayer, MePhase } from '@/views/Games/MarbleEditor/types'

export const useMarbleEditorStore = defineStore('marbleEditor', () => {
  const players = ref<Record<string, MePlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<MePhase>('lobby')
  const winnerId = ref<string | null>(null)
  const solo = ref(false)
  const raceStartTime = ref<number | null>(null)

  const playerList = computed(() =>
    Object.values(players.value).sort((a, b) => {
      if (a.finishTime !== null && b.finishTime !== null) return a.finishTime - b.finishTime
      if (a.finishTime !== null) return -1
      if (b.finishTime !== null) return 1
      return 0
    })
  )

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    return ids.length > 0 ? ids[0] : ''
  })

  const upsertPlayer = (player: MePlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([pid]) => pid !== id))
  }

  const setFinishTime = (id: string, time: number): void => {
    const player = players.value[id]
    if (!player) return
    upsertPlayer({ ...player, finishTime: time })
  }

  const clearFinishTimes = (): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).map(([id, player]) => [id, { ...player, finishTime: null }])
    )
  }

  const appendMessage = (message: ChatMessage): void => {
    messages.value = [...messages.value, message].slice(-200)
  }

  const reset = (): void => {
    players.value = {}
    messages.value = []
    phase.value = 'lobby'
    winnerId.value = null
    solo.value = false
    raceStartTime.value = null
  }

  return {
    players,
    messages,
    phase,
    winnerId,
    solo,
    raceStartTime,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    setFinishTime,
    clearFinishTimes,
    appendMessage,
    reset
  }
})
