import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'

export type WmPlayer = {
  id: string
  name: string
  color: string
  score: number
}

export type WmPhase = 'lobby' | 'playing' | 'intermission' | 'summary'

export type WmRound = {
  number: number
  grid: string[][]
  validWords: string[]
  endsAt: number | null
}

export type WmClaimedWord = {
  word: string
  playerId: string
  points: number
}

export const useSquaresMultiplayerStore = defineStore('squaresMultiplayer', () => {
  const players = ref<Record<string, WmPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<WmPhase>('lobby')
  const round = ref<WmRound>({ number: 0, grid: [], validWords: [], endsAt: null })
  const winnerId = ref<string | null>(null)
  const totalRounds = ref(5)
  const roundDuration = ref(0)
  const difficulty = ref<DictionaryDifficulty>('easy')
  const intermissionEndsAt = ref<number | null>(null)
  const claimedWords = ref<WmClaimedWord[]>([])

  const playerList = computed(() => Object.values(players.value).sort((a, b) => b.score - a.score))

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    if (ids.length === 0) return ''
    return ids[0]
  })

  const upsertPlayer = (player: WmPlayer): void => {
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

  const addClaim = (claim: WmClaimedWord): void => {
    const alreadyClaimed = claimedWords.value.some(
      (cw) => cw.word.toUpperCase() === claim.word.toUpperCase()
    )
    if (!alreadyClaimed) {
      claimedWords.value = [...claimedWords.value, claim]
    }
  }

  const reset = (): void => {
    players.value = {}
    messages.value = []
    phase.value = 'lobby'
    round.value = { number: 0, grid: [], validWords: [], endsAt: null }
    winnerId.value = null
    intermissionEndsAt.value = null
    claimedWords.value = []
  }

  const resetRound = (): void => {
    claimedWords.value = []
  }

  return {
    players,
    messages,
    phase,
    round,
    winnerId,
    totalRounds,
    roundDuration,
    difficulty,
    intermissionEndsAt,
    claimedWords,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    addScore,
    appendMessage,
    addClaim,
    reset,
    resetRound
  }
})
