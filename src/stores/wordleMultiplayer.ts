import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'

export type WlPlayer = {
  id: string
  name: string
  color: string
  score: number
}

export type WlPhase = 'lobby' | 'playing' | 'intermission' | 'summary'

export type WlRound = {
  number: number
  word: string
  endsAt: number | null
  maxAttempts: number
}

export type LetterStatus = 'correct' | 'present' | 'absent'

export type GuessRow = {
  word: string
  result: LetterStatus[]
}

export const useWordleMultiplayerStore = defineStore('wordleMultiplayer', () => {
  const players = ref<Record<string, WlPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<WlPhase>('lobby')
  const round = ref<WlRound>({ number: 0, word: '', endsAt: null, maxAttempts: 6 })
  const winnerId = ref<string | null>(null)
  const totalRounds = ref(5)
  const roundDuration = ref(0)
  const difficulty = ref<DictionaryDifficulty>('easy')
  const intermissionEndsAt = ref<number | null>(null)
  const solvedPlayers = ref<Record<string, number>>({})
  const playerGuesses = ref<Record<string, GuessRow[]>>({})

  const playerList = computed(() => Object.values(players.value).sort((a, b) => b.score - a.score))

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    if (ids.length === 0) return ''
    return [...ids].sort()[0]
  })

  const upsertPlayer = (player: WlPlayer): void => {
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

  const addGuessRow = (playerId: string, row: GuessRow): void => {
    const existing = playerGuesses.value[playerId] ?? []
    playerGuesses.value = { ...playerGuesses.value, [playerId]: [...existing, row] }
  }

  const reset = (): void => {
    players.value = {}
    messages.value = []
    phase.value = 'lobby'
    round.value = { number: 0, word: '', endsAt: null, maxAttempts: 6 }
    winnerId.value = null
    intermissionEndsAt.value = null
    solvedPlayers.value = {}
    playerGuesses.value = {}
  }

  const resetRound = (): void => {
    solvedPlayers.value = {}
    playerGuesses.value = {}
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
    solvedPlayers,
    playerGuesses,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    addScore,
    appendMessage,
    addGuessRow,
    reset,
    resetRound
  }
})
