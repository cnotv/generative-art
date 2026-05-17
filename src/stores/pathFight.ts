import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'

export type PfWaypoint = { x: number; y: number; z: number }
export type PfPaths = PfWaypoint[][]

export type PfPlayer = {
  id: string
  name: string
  color: string
  paths: PfPaths
  score: number
  ready: boolean
}

export type PfPhase = 'lobby' | 'planning' | 'battle' | 'summary'

export const usePathFightStore = defineStore('pathFight', () => {
  const phase = ref<PfPhase>('lobby')
  const players = ref<Record<string, PfPlayer>>({})
  const messages = ref<ChatMessage[]>([])

  const playerList = computed(() => Object.values(players.value))

  const hostId = computed((): string => {
    const ids = Object.keys(players.value)
    return ids.length > 0 ? ids[0] : ''
  })

  const upsertPlayer = (
    player: Omit<PfPlayer, 'paths' | 'score' | 'ready'> & Partial<PfPlayer>
  ): void => {
    const existing = players.value[player.id] ?? { paths: [], score: 0, ready: false }
    players.value = {
      ...players.value,
      [player.id]: { ...existing, ...player }
    }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([pid]) => pid !== id))
  }

  const appendMessage = (message: ChatMessage): void => {
    messages.value = [...messages.value, message].slice(-200)
  }

  const setPlayerPaths = (id: string, paths: PfPaths): void => {
    if (!players.value[id]) return
    players.value = {
      ...players.value,
      [id]: { ...players.value[id], paths, ready: true }
    }
  }

  const addScore = (id: string, delta: number): void => {
    if (!players.value[id]) return
    players.value = {
      ...players.value,
      [id]: { ...players.value[id], score: players.value[id].score + delta }
    }
  }

  const reset = (): void => {
    phase.value = 'lobby'
    players.value = {}
    messages.value = []
  }

  return {
    phase,
    players,
    messages,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    appendMessage,
    setPlayerPaths,
    addScore,
    reset
  }
})
