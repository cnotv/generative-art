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
import { useMinigolfStore, type MgPlayer } from '@/stores/minigolf'
import { REANNOUNCE_DELAY_MS } from './constants'

const HELLO_CHANNEL = 'mg-hello'
const AVATAR_CHANNEL = 'mg-avatar'
const CONFIG_CHANNEL = 'mg-config'
const SCORE_CHANNEL = 'mg-score'
const START_CHANNEL = 'mg-start'
const CHAT_CHANNEL = 'mg-chat'
const BALL_POS_CHANNEL = 'mg-ball-pos'
const ADVANCE_CHANNEL = 'mg-advance'
const TURN_CHANNEL = 'mg-turn'

type HelloPayload = {
  name: string
  color: string
  scores: number[]
}

type AvatarPayload = {
  name: string
  color: string
}

type ConfigPayload = {
  holeCount: number
  selectedHoles: number[]
}

type ScorePayload = {
  id: string
  holeIndex: number
  strokes: number
}

type StartPayload = {
  holeCount: number
  selectedHoles: number[]
}

type BallPosPayload = {
  id: string
  x: number
  y: number
  z: number
}

type AdvancePayload = {
  holeIndex: number
}

type TurnPayload = {
  playerIndex: number
}

type UseMinigolfSessionOptions = {
  name: string
  color: string
  roomId: string
}

type MgContext = {
  options: UseMinigolfSessionOptions
  store: ReturnType<typeof useMinigolfStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
}

const announceSelf = (ctx: MgContext, joined: P2PSession): void => {
  const player: MgPlayer = {
    id: joined.peerId,
    name: ctx.options.name,
    color: ctx.options.color,
    scores: []
  }
  ctx.store.upsertPlayer(player)
  const hello: HelloPayload = { name: ctx.options.name, color: ctx.options.color, scores: [] }
  p2pSendData(joined, HELLO_CHANNEL, hello)
  setTimeout(() => {
    p2pSendData(joined, HELLO_CHANNEL, hello)
  }, REANNOUNCE_DELAY_MS)
}

const sendConfig = (ctx: MgContext, target: P2PSession): void => {
  const payload: ConfigPayload = {
    holeCount: ctx.store.holeCount,
    selectedHoles: ctx.store.selectedHoles
  }
  p2pSendData(target, CONFIG_CHANNEL, payload)
}

const bindPeerEvents = (ctx: MgContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, (_peerId) => {
    const hello: HelloPayload = {
      name: ctx.options.name,
      color: ctx.options.color,
      scores: ctx.store.players[ctx.localPeerId.value]?.scores ?? []
    }
    p2pSendData(joined, HELLO_CHANNEL, hello)
    if (ctx.isHost.value) sendConfig(ctx, joined)
  })

  p2pOnPeerLeave(joined, (peerId) => {
    ctx.store.removePlayer(peerId)
  })
}

const bindDataEvents = (ctx: MgContext, joined: P2PSession): void => {
  p2pOnData<HelloPayload>(joined, HELLO_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      scores: payload.scores ?? []
    })
  })

  p2pOnData<AvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    const existing = ctx.store.players[peerId]
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      scores: existing?.scores ?? []
    })
  })

  p2pOnData<ConfigPayload>(joined, CONFIG_CHANNEL, (payload) => {
    ctx.store.holeCount = payload.holeCount
    ctx.store.selectedHoles = payload.selectedHoles
  })

  p2pOnData<ScorePayload>(joined, SCORE_CHANNEL, (payload) => {
    ctx.store.recordScore(payload.id, payload.holeIndex, payload.strokes)
  })

  p2pOnData<StartPayload>(joined, START_CHANNEL, (payload) => {
    ctx.store.holeCount = payload.holeCount
    ctx.store.selectedHoles = payload.selectedHoles
    ctx.store.currentHole = 0
    ctx.store.phase = 'playing'
  })

  p2pOnData<BallPosPayload>(joined, BALL_POS_CHANNEL, (payload, peerId) => {
    if (!peerId) return
    ctx.store.setRemoteBallPosition(peerId, payload.x, payload.y, payload.z)
  })

  p2pOnData<AdvancePayload>(joined, ADVANCE_CHANNEL, (payload) => {
    if (payload.holeIndex < 0) {
      ctx.store.phase = 'summary'
    } else {
      ctx.store.currentHole = payload.holeIndex
    }
  })

  p2pOnData<TurnPayload>(joined, TURN_CHANNEL, (payload) => {
    ctx.store.setCurrentPlayerIndex(payload.playerIndex)
  })

  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => {
    ctx.store.appendMessage(message)
  })
}

const initSessionForContext = (ctx: MgContext, roomId: string): void => {
  if (!p2pIsSupported()) return
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindDataEvents(ctx, joined)
}

/**
 * Manage a Minigolf multiplayer session (peers, chat, score tracking, game lifecycle).
 * @param options - Session configuration including player name, color, and room ID.
 * @returns Session controls and reactive state for the consuming view.
 */
export const useMinigolfSession = (options: UseMinigolfSessionOptions) => {
  const store = useMinigolfStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const ctx: MgContext = {
    options,
    store,
    session,
    localPeerId,
    isHost
  }

  /**
   * Update the local player's display name and color and broadcast to peers.
   * @param name - New display name.
   * @param color - New color hex string.
   */
  const updateProfile = (name: string, color: string): void => {
    options.name = name
    options.color = color
    const existing = store.players[localPeerId.value]
    store.upsertPlayer({ id: localPeerId.value, name, color, scores: existing?.scores ?? [] })
    if (session.value) {
      const avatar: AvatarPayload = { name, color }
      p2pSendData(session.value, AVATAR_CHANNEL, avatar)
    }
  }

  /**
   * Broadcast updated game configuration to all peers (host only).
   * @param holeCount - Number of holes for the round.
   * @param selectedHoles - Indices of the selected holes to play.
   */
  const broadcastConfig = (holeCount: number, selectedHoles: number[]): void => {
    if (!session.value) return
    store.holeCount = holeCount
    store.selectedHoles = selectedHoles
    const payload: ConfigPayload = { holeCount, selectedHoles }
    p2pSendData(session.value, CONFIG_CHANNEL, payload)
  }

  /**
   * Broadcast the game start signal to all peers (host only).
   */
  const broadcastStart = (): void => {
    if (!session.value || !isHost.value) return
    const payload: StartPayload = {
      holeCount: store.holeCount,
      selectedHoles: store.selectedHoles
    }
    store.currentHole = 0
    store.phase = 'playing'
    p2pSendData(session.value, START_CHANNEL, payload)
  }

  /**
   * Broadcast a player's score for a given hole to all peers.
   * @param holeIndex - Zero-based hole index.
   * @param strokes - Number of strokes taken.
   */
  const broadcastScore = (holeIndex: number, strokes: number): void => {
    if (!session.value) return
    store.recordScore(localPeerId.value, holeIndex, strokes)
    const payload: ScorePayload = { id: localPeerId.value, holeIndex, strokes }
    p2pSendData(session.value, SCORE_CHANNEL, payload)
  }

  /**
   * Broadcast hole advancement to all peers. Pass -1 to signal game over (summary).
   * @param holeIndex - Next hole index, or -1 for summary.
   */
  const broadcastAdvanceHole = (holeIndex: number): void => {
    if (!session.value) return
    p2pSendData(session.value, ADVANCE_CHANNEL, { holeIndex })
  }

  /**
   * Broadcast the local ball position to all peers (called every frame during play).
   * @param x - Ball X position.
   * @param y - Ball Y position.
   * @param z - Ball Z position.
   */
  const broadcastBallPosition = (x: number, y: number, z: number): void => {
    if (!session.value) return
    const payload: BallPosPayload = { id: localPeerId.value, x, y, z }
    p2pSendData(session.value, BALL_POS_CHANNEL, payload)
  }

  /**
   * Send a chat message to all peers.
   * @param text - The chat message text.
   */
  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const message = chatMessageCreate(localPeerId.value, options.name, text)
    if (!message) return
    store.appendMessage(message)
    p2pSendData(session.value, CHAT_CHANNEL, message)
  }

  /**
   * Initialize the P2P session and join the room.
   */
  const init = (): void => initSessionForContext(ctx, options.roomId)

  /**
   * Reconnect to a new room, leaving the current one first.
   * @param newRoomId - The new room ID to join.
   */
  const reconnect = (newRoomId: string): void => {
    destroy()
    initSessionForContext(ctx, newRoomId)
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
    broadcastConfig,
    broadcastStart,
    broadcastScore,
    broadcastAdvanceHole,
    broadcastBallPosition,
    broadcastChat,
    init,
    reconnect
  }
}
