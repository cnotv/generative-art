import type { Ref } from 'vue'
import { useRouter } from 'vue-router'
import { saveProfile } from '@/utils/playerProfile'

type SessionInterface = {
  updateProfile: (name: string, color: string) => void
  reconnect: (roomId: string) => void
}

/**
 * Shared lobby event handlers for all multiplayer games.
 * Covers player profile updates and room navigation (match found, leave room).
 * Game-specific logic (start, restart, solo) belongs in each game's component.
 * @param playerName - Reactive player name ref.
 * @param playerColor - Reactive player color ref.
 * @param roomId - Reactive room ID ref.
 * @param session - Session object exposing updateProfile and reconnect.
 * @returns Event handler functions for use in the lobby template.
 */
export const useMultiplayerLobbyHandlers = (
  playerName: Ref<string>,
  playerColor: Ref<string>,
  roomId: Ref<string>,
  session: SessionInterface
) => {
  const router = useRouter()

  const handleNameChange = (): void => {
    const trimmed = playerName.value.trim()
    if (!trimmed) return
    session.updateProfile(trimmed, playerColor.value)
    saveProfile(trimmed, playerColor.value)
  }

  const handleColorChange = (color: string): void => {
    playerColor.value = color
    session.updateProfile(playerName.value, color)
    saveProfile(playerName.value, color)
  }

  const handleMatchFound = (gameRoomId: string): void => {
    roomId.value = gameRoomId
    router.replace({ query: { room: gameRoomId } })
    session.reconnect(gameRoomId)
  }

  const handleLeaveRoom = (): void => {
    const freshId = crypto.randomUUID()
    roomId.value = freshId
    router.replace({ query: { room: freshId } })
    session.reconnect(freshId)
  }

  return { handleNameChange, handleColorChange, handleMatchFound, handleLeaveRoom }
}
