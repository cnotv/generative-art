import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'

export type PictionaryPlayer = {
  id: string
  name: string
  color: string
  score: number
}

export type PictionaryPhase = 'lobby' | 'choosing' | 'drawing' | 'intermission' | 'summary'

export type PictionaryRound = {
  number: number
  drawerId: string
  word: string | null
  endsAt: number | null
  choices: string[]
}

export const usePictionaryStore = defineStore('pictionary', () => {
  const players = ref<Record<string, PictionaryPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<PictionaryPhase>('lobby')
  const round = ref<PictionaryRound>({
    number: 0,
    drawerId: '',
    word: null,
    endsAt: null,
    choices: []
  })
  const winnerId = ref<string | null>(null)
  const totalRounds = ref(5)
  const roundDuration = ref(60)
  const wordCount = ref(1)
  const intermissionEndsAt = ref<number | null>(null)

  const playerList = computed(() =>
    Object.values(players.value).sort((playerA, playerB) => playerB.score - playerA.score)
  )

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    if (ids.length === 0) return ''
    return [...ids].sort()[0]
  })

  const upsertPlayer = (player: PictionaryPlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).filter(([playerId]) => playerId !== id)
    )
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
    round.value = { number: 0, drawerId: '', word: null, endsAt: null, choices: [] }
    winnerId.value = null
    intermissionEndsAt.value = null
  }

  return {
    players,
    messages,
    phase,
    round,
    winnerId,
    totalRounds,
    roundDuration,
    wordCount,
    intermissionEndsAt,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    addScore,
    appendMessage,
    reset
  }
})
