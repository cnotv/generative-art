import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { ScheduledNote } from '@webgamekit/audio'
import type {
  RgSong,
  RgDifficulty,
  RgInstrument,
  RhythmNote
} from '@/views/Games/RhythmGame/config'

export type RgScore = {
  score: number
  combo: number
  maxCombo: number
  perfect: number
  good: number
  miss: number
}

export type RgPlayer = {
  id: string
  name: string
  color: string
  score: number
  combo: number
  maxCombo: number
  perfect: number
  good: number
  miss: number
}

export type RgPhase = 'lobby' | 'playing' | 'summary'

export const useRhythmGameStore = defineStore('rhythmGame', () => {
  const players = ref<Record<string, RgPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<RgPhase>('lobby')
  const winnerId = ref<string | null>(null)
  const solo = ref(false)
  const song = ref<RgSong>('electric-pulse')
  const difficulty = ref<RgDifficulty>('medium')
  const instrument = ref<RgInstrument>('piano')
  const customNotes = ref<RhythmNote[] | null>(null)
  const customSongName = ref('')
  const backgroundNotes = ref<ScheduledNote[] | null>(null)

  const playerList = computed(() => Object.values(players.value).sort((a, b) => b.score - a.score))

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    return ids.length > 0 ? ids[0] : ''
  })

  const upsertPlayer = (player: RgPlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([pid]) => pid !== id))
  }

  const updateScore = (id: string, data: RgScore): void => {
    const player = players.value[id]
    if (!player) return
    upsertPlayer({ ...player, ...data })
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

  const resetForReplay = (): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).map(([id, p]) => [
        id,
        { ...p, score: 0, combo: 0, maxCombo: 0, perfect: 0, good: 0, miss: 0 }
      ])
    )
    phase.value = 'lobby'
    winnerId.value = null
  }

  return {
    players,
    messages,
    phase,
    winnerId,
    solo,
    song,
    difficulty,
    instrument,
    customNotes,
    customSongName,
    backgroundNotes,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    updateScore,
    appendMessage,
    reset,
    resetForReplay
  }
})
