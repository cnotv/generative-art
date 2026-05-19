import { ref, computed, onUnmounted } from 'vue'
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
import { useBubbleShooterStore, type BsPlayer } from '@/stores/bubbleShooter'
import { MATCHMAKER_ROOM } from './config'
import type {
  HelloPayload,
  AvatarPayload,
  StartPayload,
  GarbagePayload,
  ScorePayload,
  GameOverPayload,
  UseBubbleShooterSessionOptions,
  BsContext
} from './types'

const CONFIG_CHANNEL = 'bs-config'
const HELLO_CHANNEL = 'bs-hello'
const AVATAR_CHANNEL = 'bs-avatar'
const START_CHANNEL = 'bs-start'
const GARBAGE_CHANNEL = 'bs-garbage'
const SCORE_CHANNEL = 'bs-score'
const GAMEOVER_CHANNEL = 'bs-gameover'
const CHAT_CHANNEL = 'bs-chat'
const RESTART_CHANNEL = 'bs-restart'

const REANNOUNCE_DELAY_MS = 2000

const announceSelf = (ctx: BsContext, joined: P2PSession): void => {
  const player: BsPlayer = {
    id: joined.peerId,
    name: ctx.options.name,
    color: ctx.options.color,
    score: 0
  }
  ctx.store.upsertPlayer(player)
  p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  setTimeout(() => {
    if (ctx.session.value) {
      p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    }
  }, REANNOUNCE_DELAY_MS)
}

const bindPeerEvents = (ctx: BsContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, (_peerId) => {
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    p2pSendData(joined, HELLO_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    if (ctx.isHost.value) p2pSendData(joined, CONFIG_CHANNEL, { difficulty: ctx.store.difficulty })
  })

  p2pOnPeerLeave(joined, (peerId) => {
    const player = ctx.store.players[peerId]
    if (player) {
      const leaveMessage: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: 'system',
        senderName: 'System',
        text: `${player.name} left the game`,
        timestamp: Date.now(),
        kind: 'system'
      }
      ctx.store.appendMessage(leaveMessage)
    }
    ctx.store.removePlayer(peerId)
    if (
      ctx.store.phase === 'playing' &&
      Object.keys(ctx.store.players).length <= 1 &&
      ctx.isHost.value
    ) {
      ctx.store.winnerId = ctx.localPeerId.value
      ctx.store.phase = 'summary'
    }
  })

  p2pOnData<HelloPayload>(joined, HELLO_CHANNEL, (payload, peerId) => {
    ctx.store.upsertPlayer({ id: peerId, name: payload.name, color: payload.color, score: 0 })
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  })

  p2pOnData<AvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    const existing = ctx.store.players[peerId]
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      score: existing?.score ?? 0
    })
  })
}

const bindGameEvents = (ctx: BsContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => ctx.store.appendMessage(message))

  p2pOnData<{ difficulty: string }>(joined, CONFIG_CHANNEL, (payload) => {
    ctx.store.difficulty = payload.difficulty as typeof ctx.store.difficulty
  })

  p2pOnData<StartPayload>(joined, START_CHANNEL, () => {
    ctx.store.phase = 'playing'
  })

  p2pOnData<GarbagePayload>(joined, GARBAGE_CHANNEL, (payload) => {
    ctx.onGarbage(payload.count)
  })

  p2pOnData<ScorePayload>(joined, SCORE_CHANNEL, (payload, peerId) => {
    const existing = ctx.store.players[peerId]
    if (existing) ctx.store.upsertPlayer({ ...existing, score: payload.score })
  })

  p2pOnData<GameOverPayload>(joined, GAMEOVER_CHANNEL, (payload) => {
    const survivorId = Object.keys(ctx.store.players).find((id) => id !== payload.loserId)
    ctx.store.winnerId = survivorId ?? payload.loserId
    ctx.store.phase = 'summary'
  })

  p2pOnData<Record<string, never>>(joined, RESTART_CHANNEL, () => {
    const preserved = Object.fromEntries(
      Object.entries(ctx.store.players).map(([id, p]) => [id, { ...p, score: 0 }])
    )
    ctx.store.$patch({ players: preserved, phase: 'lobby', winnerId: null, messages: [] })
  })
}

const initSessionForContext = (ctx: BsContext, roomId: string): void => {
  if (!p2pIsSupported()) return
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindGameEvents(ctx, joined)
}

/**
 * Manage a BubbleShooter P2P session (peers, chat, garbage sync, game-over).
 * @param options - Session configuration including name, color, and room ID.
 * @returns Session controls and reactive state for the consuming view.
 */
export const useBubbleShooterSession = (
  options: UseBubbleShooterSessionOptions,
  onGarbage: (count: number) => void = () => {}
) => {
  const store = useBubbleShooterStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const ctx: BsContext = {
    options,
    store,
    session,
    localPeerId,
    isHost,
    onGarbage
  }

  const startGame = (): void => {
    if (!session.value || !isHost.value) return
    const payload: StartPayload = { seed: Math.floor(Math.random() * 1_000_000) }
    p2pSendData(session.value, START_CHANNEL, payload)
    store.phase = 'playing'
  }

  const broadcastGarbage = (count: number): void => {
    if (!session.value) return
    p2pSendData(session.value, GARBAGE_CHANNEL, { count })
  }

  const broadcastScore = (score: number): void => {
    if (!session.value) return
    p2pSendData(session.value, SCORE_CHANNEL, { playerId: localPeerId.value, score })
  }

  const broadcastGameOver = (): void => {
    if (!session.value) return
    p2pSendData(session.value, GAMEOVER_CHANNEL, { loserId: localPeerId.value })
    const survivorId = Object.keys(store.players).find((id) => id !== localPeerId.value)
    store.winnerId = survivorId ?? localPeerId.value
    store.phase = 'summary'
  }

  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const message = chatMessageCreate(localPeerId.value, options.name, text)
    if (!message) return
    store.appendMessage(message)
    p2pSendData(session.value, CHAT_CHANNEL, message)
  }

  const updateProfile = (name: string, color: string): void => {
    options.name = name
    options.color = color
    const existing = store.players[localPeerId.value]
    store.upsertPlayer({ id: localPeerId.value, name, color, score: existing?.score ?? 0 })
    if (session.value) p2pSendData(session.value, AVATAR_CHANNEL, { name, color })
  }

  const restartGame = (): void => {
    if (!isHost.value || !session.value) return
    p2pSendData(session.value, RESTART_CHANNEL, {})
    const preserved = Object.fromEntries(
      Object.entries(store.players).map(([id, p]) => [id, { ...p, score: 0 }])
    )
    store.$patch({ players: preserved, phase: 'lobby', winnerId: null, messages: [] })
  }

  const init = (): void => initSessionForContext(ctx, options.roomId)

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
    session,
    localPeerId,
    isHost,
    matchmakerRoom: MATCHMAKER_ROOM,
    startGame,
    broadcastGarbage,
    broadcastScore,
    broadcastGameOver,
    broadcastChat,
    updateProfile,
    restartGame,
    init,
    reconnect
  }
}
