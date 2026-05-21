import { ref, computed, onUnmounted, type ComputedRef, type Ref } from 'vue'
import { chatMessageCreate, type ChatMessage } from '@webgamekit/chat'
import {
  p2pJoin,
  p2pLeave,
  p2pSendData,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pOnData,
  p2pIsSupported,
  type P2PSession
} from '@webgamekit/multiplayer-p2p'

const REANNOUNCE_DELAY_MS = 2000

type AvatarPayload = { name: string; color: string }

/**
 * Options for the base multiplayer session composable.
 * TPlayer must include the base fields required for avatar/chat handling.
 */
export type BaseSessionOptions<TPlayer extends { id: string; name: string; color: string }> = {
  roomId: string
  matchmakerRoom: string
  channels: { avatar: string; chat: string; restart: string }
  getProfile: () => AvatarPayload
  setProfile: (name: string, color: string) => void
  getHostId: () => string
  getPlayer: (peerId: string) => TPlayer | undefined
  onUpsertPlayer: (player: TPlayer) => void
  onRemovePlayer: (peerId: string) => void
  onAppendMessage: (message: ChatMessage) => void
  makeSelfPlayer: (peerId: string) => TPlayer
  makePeerPlayer: (peerId: string, data: AvatarPayload, existing: TPlayer | undefined) => TPlayer
  onPeerJoin?: (s: P2PSession, isHost: ComputedRef<boolean>) => void
  onData?: (s: P2PSession, localPeerId: Ref<string>, isHost: ComputedRef<boolean>) => void
  onRestart: () => void
}

const announceSelf = <TPlayer extends { id: string; name: string; color: string }>(
  s: P2PSession,
  options: BaseSessionOptions<TPlayer>
): void => {
  const { name, color } = options.getProfile()
  options.onUpsertPlayer(options.makeSelfPlayer(s.peerId))
  p2pSendData(s, options.channels.avatar, { name, color })
  setTimeout(() => {
    p2pSendData(s, options.channels.avatar, { name, color })
  }, REANNOUNCE_DELAY_MS)
}

const bindEvents = <TPlayer extends { id: string; name: string; color: string }>(
  s: P2PSession,
  localPeerId: Ref<string>,
  isHost: ComputedRef<boolean>,
  options: BaseSessionOptions<TPlayer>
): void => {
  p2pOnPeerJoin(s, () => {
    const { name, color } = options.getProfile()
    p2pSendData(s, options.channels.avatar, { name, color })
    options.onPeerJoin?.(s, isHost)
  })

  p2pOnPeerLeave(s, (peerId) => {
    options.onRemovePlayer(peerId)
  })

  p2pOnData(s, options.channels.avatar, (data: AvatarPayload, peerId) => {
    options.onUpsertPlayer(options.makePeerPlayer(peerId, data, options.getPlayer(peerId)))
  })

  p2pOnData(s, options.channels.chat, (data: { text: string }, peerId) => {
    const player = options.getPlayer(peerId)
    if (!player) return
    options.onAppendMessage(chatMessageCreate(peerId, player.name, player.color, data.text))
  })

  p2pOnData(s, options.channels.restart, () => {
    options.onRestart()
  })

  options.onData?.(s, localPeerId, isHost)
}

/**
 * Base P2P session composable shared by all multiplayer games.
 * Handles session lifecycle, host detection, avatar sync, chat, and restart.
 * Games add game-specific channels via the onPeerJoin and onData hooks.
 * @param options - Session configuration and store callbacks.
 * @returns Reactive session state and control functions.
 */
export const useBaseMultiplayerSession = <
  TPlayer extends { id: string; name: string; color: string }
>(
  options: BaseSessionOptions<TPlayer>
) => {
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref('')
  const isHost = computed(() => !!localPeerId.value && options.getHostId() === localPeerId.value)

  const _connect = async (roomId: string): Promise<void> => {
    const s = await p2pJoin(roomId, options.matchmakerRoom)
    session.value = s
    localPeerId.value = s.peerId
    announceSelf(s, options)
    bindEvents(s, localPeerId, isHost, options)
  }

  const init = async (): Promise<void> => {
    if (!p2pIsSupported()) return
    await _connect(options.roomId)
  }

  const reconnect = async (newRoomId: string): Promise<void> => {
    if (session.value) p2pLeave(session.value)
    session.value = null
    if (!p2pIsSupported()) return
    await _connect(newRoomId)
  }

  const updateProfile = (name: string, color: string): void => {
    if (!session.value) return
    options.setProfile(name, color)
    p2pSendData(session.value, options.channels.avatar, { name, color })
  }

  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const player = options.getPlayer(localPeerId.value)
    if (!player) return
    options.onAppendMessage(chatMessageCreate(localPeerId.value, player.name, player.color, text))
    p2pSendData(session.value, options.channels.chat, { text })
  }

  const restartGame = (): void => {
    if (!session.value) return
    p2pSendData(session.value, options.channels.restart, {})
    options.onRestart()
  }

  onUnmounted(() => {
    if (session.value) p2pLeave(session.value)
  })

  return {
    session,
    localPeerId,
    isHost,
    init,
    reconnect,
    updateProfile,
    broadcastChat,
    restartGame
  }
}
