import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import {
  p2pJoin,
  p2pLeave,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pSendData,
  p2pOnData,
  p2pIsSupported,
  type P2PSession
} from '@webgamekit/multiplayer-p2p'
import { chatMessageCreate, type ChatMessage } from '@webgamekit/chat'
import { usePathFightStore, type PfPaths, type PfPlayer } from '@/stores/pathFight'
import { REANNOUNCE_DELAY_MS } from './constants'

const HELLO_CHANNEL = 'pf-hello'
const AVATAR_CHANNEL = 'pf-avatar'
const PATHS_CHANNEL = 'pf-paths'
const START_CHANNEL = 'pf-start'
const SCORE_CHANNEL = 'pf-score'
const CHAT_CHANNEL = 'pf-chat'

type HelloPayload = { name: string; color: string }
type AvatarPayload = { name: string; color: string }
type PathsPayload = { paths: PfPaths }
type ScorePayload = { score: number }

type SessionOptions = { name: string; color: string; roomId: string }

type PfContext = {
  options: SessionOptions
  store: ReturnType<typeof usePathFightStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
}

const announceSelf = (ctx: PfContext, joined: P2PSession): void => {
  const player: PfPlayer = {
    id: joined.peerId,
    name: ctx.options.name,
    color: ctx.options.color,
    paths: [],
    score: 0,
    ready: false
  }
  ctx.store.upsertPlayer(player)
  const hello: HelloPayload = { name: ctx.options.name, color: ctx.options.color }
  p2pSendData(joined, HELLO_CHANNEL, hello)
  setTimeout(() => p2pSendData(joined, HELLO_CHANNEL, hello), REANNOUNCE_DELAY_MS)
}

const bindPeerEvents = (ctx: PfContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, (_peerId) => {
    const hello: HelloPayload = { name: ctx.options.name, color: ctx.options.color }
    p2pSendData(joined, HELLO_CHANNEL, hello)
  })

  p2pOnPeerLeave(joined, (peerId) => {
    ctx.store.removePlayer(peerId)
  })
}

const bindDataEvents = (ctx: PfContext, joined: P2PSession): void => {
  p2pOnData<HelloPayload>(joined, HELLO_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    ctx.store.upsertPlayer({ id: peerId, name: payload.name, color: payload.color })
  })

  p2pOnData<AvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    ctx.store.upsertPlayer({ id: peerId, name: payload.name, color: payload.color })
  })

  p2pOnData<PathsPayload>(joined, PATHS_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    ctx.store.setPlayerPaths(peerId, payload.paths)
  })

  p2pOnData<Record<string, never>>(joined, START_CHANNEL, () => {
    ctx.store.phase = 'battle'
  })

  p2pOnData<ScorePayload>(joined, SCORE_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    const player = ctx.store.players[peerId]
    if (player) {
      ctx.store.upsertPlayer({ ...player, score: payload.score })
    }
  })

  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => {
    ctx.store.appendMessage(message)
  })
}

const initSession = (ctx: PfContext, roomId: string): void => {
  if (!p2pIsSupported()) return
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindDataEvents(ctx, joined)
}

/**
 * Manage a PathFight multiplayer P2P session.
 * @param options - Player name, color, and room ID.
 * @returns Session controls for the consuming view.
 */
export const usePathFightSession = (options: SessionOptions) => {
  const store = usePathFightStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const ctx: PfContext = { options, store, session, localPeerId, isHost }

  /**
   * Update local player name/color and broadcast to peers.
   * @param name - New display name.
   * @param color - New color hex string.
   */
  const updateProfile = (name: string, color: string): void => {
    options.name = name
    options.color = color
    store.upsertPlayer({ id: localPeerId.value, name, color })
    if (session.value) {
      p2pSendData(session.value, AVATAR_CHANNEL, { name, color } satisfies AvatarPayload)
    }
  }

  /**
   * Broadcast drawn goomba paths to peers and mark local player as ready.
   * @param paths - Array of 10 waypoint lists, one per goomba.
   */
  const broadcastPaths = (paths: PfPaths): void => {
    if (!session.value) return
    store.setPlayerPaths(localPeerId.value, paths)
    p2pSendData(session.value, PATHS_CHANNEL, { paths } satisfies PathsPayload)
  }

  /**
   * Broadcast the battle start signal (host only).
   */
  const broadcastStart = (): void => {
    if (!session.value || !isHost.value) return
    store.phase = 'battle'
    p2pSendData(session.value, START_CHANNEL, {})
  }

  /**
   * Broadcast final local score to peers.
   * @param score - Total score this round.
   */
  const broadcastScore = (score: number): void => {
    if (!session.value) return
    store.upsertPlayer({ id: localPeerId.value, name: options.name, color: options.color, score })
    p2pSendData(session.value, SCORE_CHANNEL, { score } satisfies ScorePayload)
  }

  /**
   * Send a chat message to all peers.
   * @param text - Chat message text.
   */
  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const message = chatMessageCreate(localPeerId.value, options.name, text)
    if (!message) return
    store.appendMessage(message)
    p2pSendData(session.value, CHAT_CHANNEL, message)
  }

  /**
   * Initialise the P2P session and join the room.
   */
  const init = (): void => initSession(ctx, options.roomId)

  /**
   * Reconnect to a new room, leaving the current one first.
   * @param newRoomId - Room ID to join.
   */
  const reconnect = (newRoomId: string): void => {
    destroy()
    initSession(ctx, newRoomId)
  }

  const destroy = (): void => {
    if (session.value) {
      p2pLeave(session.value)
      session.value = null
    }
    store.reset()
  }

  onUnmounted(destroy)

  return {
    isHost,
    localPeerId,
    updateProfile,
    broadcastPaths,
    broadcastStart,
    broadcastScore,
    broadcastChat,
    init,
    reconnect
  }
}
