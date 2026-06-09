import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'

export type MgPlayer = {
  id: string
  name: string
  color: string
  scores: number[]
}

export type MgPhase = 'lobby' | 'playing' | 'summary'

export const useMinigolfStore = defineStore('minigolf', () => {
  const players = ref<Record<string, MgPlayer>>({})
  const messages = ref<ChatMessage[]>([])
  const phase = ref<MgPhase>('lobby')
  const currentHole = ref(0)
  const holeCount = ref(10)
  const selectedHoles = ref<number[]>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  const remoteBallPositions = ref<Record<string, { x: number; y: number; z: number }>>({})

  const setRemoteBallPosition = (peerId: string, x: number, y: number, z: number): void => {
    remoteBallPositions.value = { ...remoteBallPositions.value, [peerId]: { x, y, z } }
  }

  const playerList = computed(() =>
    Object.values(players.value).sort((a, b) => {
      const scoreDiff =
        a.scores.reduce((sum, s) => sum + s, 0) - b.scores.reduce((sum, s) => sum + s, 0)
      return scoreDiff !== 0 ? scoreDiff : a.id.localeCompare(b.id)
    })
  )

  const hostId = computed(() => {
    const ids = Object.keys(players.value)
    if (ids.length === 0) return ''
    return ids[0]
  })

  const upsertPlayer = (player: MgPlayer): void => {
    players.value = { ...players.value, [player.id]: { ...players.value[player.id], ...player } }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(
      Object.entries(players.value).filter(([playerId]) => playerId !== id)
    )
  }

  const appendMessage = (message: ChatMessage): void => {
    messages.value = [...messages.value, message].slice(-200)
  }

  const recordScore = (id: string, holeIndex: number, strokes: number): void => {
    const player = players.value[id]
    if (!player) return
    const updatedScores = player.scores.map((s, i) => (i === holeIndex ? strokes : s))
    const paddedScores =
      holeIndex >= updatedScores.length
        ? [
            ...updatedScores,
            ...Array.from({ length: holeIndex - updatedScores.length }, () => 0),
            strokes
          ]
        : updatedScores
    upsertPlayer({ ...player, scores: paddedScores })
  }

  const reset = (): void => {
    players.value = {}
    messages.value = []
    phase.value = 'lobby'
    currentHole.value = 0
    holeCount.value = 10
    selectedHoles.value = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    remoteBallPositions.value = {}
  }

  const resetGameState = (): void => {
    currentHole.value = 0
    remoteBallPositions.value = {}
    players.value = Object.fromEntries(
      Object.entries(players.value).map(([id, player]) => [
        id,
        { ...player, scores: [] as number[] }
      ])
    )
  }

  return {
    players,
    messages,
    phase,
    currentHole,
    holeCount,
    selectedHoles,
    playerList,
    hostId,
    upsertPlayer,
    removePlayer,
    appendMessage,
    recordScore,
    setRemoteBallPosition,
    remoteBallPositions,
    reset,
    resetGameState
  }
})
