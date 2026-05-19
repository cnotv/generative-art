import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { BsColorCount, BsSpeed } from '@/views/Games/BubbleShooter/config'

export type BsPlayer = {
  id: string
  name: string
  color: string
  score: number
}

export type BsPhase = 'lobby' | 'playing' | 'summary'

export const useBubbleShooterStore = defineStore('bubbleShooter', () => {
  const players = ref<Record<string, BsPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<BsPhase>('lobby')
  const winnerId = ref<string | null>(null)
  const solo = ref(false)
  const colorCount = ref<BsColorCount>(4)
  const speed = ref<BsSpeed>('medium')

  const playerList = computed(() => Object.values(players.value).sort((a, b) => b.score - a.score))

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    return ids.length > 0 ? ids[0] : ''
  })

  const upsertPlayer = (player: BsPlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([pid]) => pid !== id))
  }

  const addScore = (id: string, points: number): void => {
    const player = players.value[id]
    if (!player) return
    upsertPlayer({ ...player, score: player.score + points })
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
  }

  return {
    players,
    messages,
    phase,
    winnerId,
    solo,
    colorCount,
    speed,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    addScore,
    appendMessage,
    reset
  }
})
