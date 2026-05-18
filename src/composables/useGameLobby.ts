import { ref, computed, onUnmounted, type Ref } from 'vue'
import {
  p2pIsSupported,
  p2pLobbyJoin,
  type LobbyHandle,
  type MatchRequest
} from '@webgamekit/multiplayer-p2p'

const PEER_ID_DISPLAY_LENGTH = 8

type PendingRequest = { request: MatchRequest; fromPeerId: string }

type UseGameLobbyOptions = {
  matchmakerRoom: string
  getRoomId: () => string
  getPlayerName: () => string
}

/**
 * Shared matchmaker lobby state and actions for multiplayer games.
 * @param options - Lobby configuration.
 * @returns Reactive state and handlers for lobby search/accept/ignore.
 */
export const useGameLobby = ({
  matchmakerRoom,
  getRoomId,
  getPlayerName,
  onMatchAccepted
}: UseGameLobbyOptions & { onMatchAccepted?: () => void }) => {
  const lobbyHandle = ref<LobbyHandle | null>(null) as Ref<LobbyHandle | null>
  const pendingRequests = ref<PendingRequest[]>([])
  const peerNames = ref<Record<string, string>>({})
  const isSearching = computed(() => lobbyHandle.value !== null)

  const stopSearching = (): void => {
    lobbyHandle.value?.stop()
    lobbyHandle.value = null
    pendingRequests.value = []
    peerNames.value = {}
  }

  const startSearching = (): void => {
    if (!p2pIsSupported() || lobbyHandle.value) return

    const handle = p2pLobbyJoin(matchmakerRoom, undefined, {
      onPeerJoin: (peerId) => {
        handle.sendRequest(peerId, getRoomId())
      },
      onPeerLeave: (peerId) => {
        pendingRequests.value = pendingRequests.value.filter((r) => r.fromPeerId !== peerId)
      },
      onRequest: (request, fromPeerId) => {
        if (!pendingRequests.value.some((r) => r.fromPeerId === fromPeerId)) {
          pendingRequests.value = [...pendingRequests.value, { request, fromPeerId }]
        }
      },
      onAccepted: () => {
        // Our outgoing request was accepted — peer is switching to our room
        stopSearching()
        onMatchAccepted?.()
      },
      onIgnored: () => {},
      onPeerName: (peerId, name) => {
        peerNames.value = { ...peerNames.value, [peerId]: name }
      }
    })

    handle.getPeerIds().forEach((peerId) => handle.sendRequest(peerId, getRoomId()))
    handle.setName(getPlayerName())
    lobbyHandle.value = handle
  }

  const acceptRequest = (entry: PendingRequest): string => {
    if (!lobbyHandle.value) return ''
    lobbyHandle.value.acceptRequest(entry.request, entry.fromPeerId)
    const gameRoomId = entry.request.gameRoomId
    stopSearching()
    return gameRoomId
  }

  const ignoreRequest = (entry: PendingRequest): void => {
    if (!lobbyHandle.value) return
    lobbyHandle.value.ignoreRequest(entry.request, entry.fromPeerId)
    pendingRequests.value = pendingRequests.value.filter(
      (r) => r.request.requestId !== entry.request.requestId
    )
  }

  const displayName = (peerId: string): string =>
    peerNames.value[peerId] ?? peerId.slice(0, PEER_ID_DISPLAY_LENGTH)

  onUnmounted(stopSearching)

  return {
    isSearching,
    pendingRequests,
    peerNames,
    startSearching,
    stopSearching,
    acceptRequest,
    ignoreRequest,
    displayName
  }
}
