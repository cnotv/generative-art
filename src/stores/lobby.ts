import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChatMessage } from '@webgamekit/chat'
import type { LobbyPlayer, LobbyRoom } from '@/types/lobby'

export const useLobbyStore = defineStore('lobby', () => {
  const messages = ref<ChatMessage[]>([])
  const players = ref<Record<string, LobbyPlayer>>({})
  const rooms = ref<Record<string, LobbyRoom>>({})

  const appendMessage = (message: ChatMessage): void => {
    messages.value = [...messages.value, message]
  }

  const upsertPlayer = (player: LobbyPlayer): void => {
    players.value = { ...players.value, [player.id]: player }
  }

  const removePlayer = (id: string): void => {
    players.value = Object.fromEntries(Object.entries(players.value).filter(([k]) => k !== id))
  }

  const upsertRoom = (room: LobbyRoom): void => {
    rooms.value = { ...rooms.value, [room.id]: room }
  }

  const removeRoom = (id: string): void => {
    rooms.value = Object.fromEntries(Object.entries(rooms.value).filter(([k]) => k !== id))
  }

  const removeRoomsByHost = (hostId: string): void => {
    rooms.value = Object.fromEntries(
      Object.entries(rooms.value).filter(([, r]) => r.hostId !== hostId)
    )
  }

  const reset = (): void => {
    messages.value = []
    players.value = {}
    rooms.value = {}
  }

  return {
    messages,
    players,
    rooms,
    appendMessage,
    upsertPlayer,
    removePlayer,
    upsertRoom,
    removeRoom,
    removeRoomsByHost,
    reset
  }
})
