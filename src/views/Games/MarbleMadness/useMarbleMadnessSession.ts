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
import { useMarbleMadnessStore, type MmPlayer } from '@/stores/marbleMadness'
import { MATCHMAKER_ROOM } from './config'
import type {
  HelloPayload,
  AvatarPayload,
  StartPayload,
  BallPosPayload,
  FinishPayload,
  UseMarbleMadnessSessionOptions,
  MmContext
} from './types'

const HELLO_CHANNEL = 'mm-hello'
const AVATAR_CHANNEL = 'mm-avatar'
const START_CHANNEL = 'mm-start'
const BALL_POS_CHANNEL = 'mm-ball-pos'
const FINISH_CHANNEL = 'mm-finish'
const CHAT_CHANNEL = 'mm-chat'
const RESTART_CHANNEL = 'mm-restart'

const REANNOUNCE_DELAY_MS = 2000

const announceSelf = (ctx: MmContext, joined: P2PSession): void => {
  const player: MmPlayer = {
    id: joined.peerId,
    name: ctx.options.name,
    color: ctx.options.color,
    finishTime: null
  }
  ctx.store.upsertPlayer(player)
  p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  setTimeout(() => {
    if (ctx.session.value) {
      p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    }
  }, REANNOUNCE_DELAY_MS)
}

const bindPeerEvents = (ctx: MmContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, (_peerId) => {
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    p2pSendData(joined, HELLO_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  })

  p2pOnPeerLeave(joined, (peerId) => {
    const player = ctx.store.players[peerId]
    if (player) {
      const leaveMessage: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: 'system',
        senderName: 'System',
        text: `${player.name} left the race`,
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
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      finishTime: null
    })
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
  })

  p2pOnData<AvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    const existing = ctx.store.players[peerId]
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      finishTime: existing?.finishTime ?? null
    })
  })
}

const bindGameEvents = (ctx: MmContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => ctx.store.appendMessage(message))

  p2pOnData<StartPayload>(joined, START_CHANNEL, (payload) => {
    ctx.store.raceStartTime = payload.timestamp
    ctx.store.phase = 'playing'
  })

  p2pOnData<BallPosPayload>(joined, BALL_POS_CHANNEL, (payload, peerId) => {
    ctx.onBallPos(peerId, payload)
  })

  p2pOnData<FinishPayload>(joined, FINISH_CHANNEL, (payload) => {
    ctx.store.setFinishTime(payload.playerId, payload.time)
    if (!ctx.store.winnerId) {
      ctx.store.winnerId = payload.playerId
      ctx.store.phase = 'summary'
    }
  })

  p2pOnData<Record<string, never>>(joined, RESTART_CHANNEL, () => {
    const preserved = Object.fromEntries(
      Object.entries(ctx.store.players).map(([id, p]) => [id, { ...p, finishTime: null }])
    )
    ctx.store.$patch({
      players: preserved,
      phase: 'lobby',
      winnerId: null,
      messages: [],
      raceStartTime: null
    })
  })
}

const initSessionForContext = (ctx: MmContext, roomId: string): void => {
  if (!p2pIsSupported()) return
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindGameEvents(ctx, joined)
}

/**
 * Manage a MarbleMadness P2P session (peers, chat, ball positions, finish sync).
 * @param options - Session configuration including name, color, and room ID.
 * @param onBallPos - Called when a peer broadcasts their marble position.
 * @returns Session controls and reactive state.
 */
export const useMarbleMadnessSession = (
  options: UseMarbleMadnessSessionOptions,
  onBallPos: (peerId: string, pos: BallPosPayload) => void = () => {}
) => {
  const store = useMarbleMadnessStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const ctx: MmContext = { options, store, session, localPeerId, isHost, onBallPos }

  const startGame = (): void => {
    if (!session.value || !isHost.value) return
    const payload: StartPayload = { timestamp: Date.now() }
    p2pSendData(session.value, START_CHANNEL, payload)
    store.raceStartTime = payload.timestamp
    store.phase = 'playing'
  }

  const broadcastBallPos = (pos: BallPosPayload): void => {
    if (!session.value) return
    p2pSendData(session.value, BALL_POS_CHANNEL, pos)
  }

  const broadcastFinish = (time: number): void => {
    if (!session.value) return
    const payload: FinishPayload = { playerId: localPeerId.value, time }
    p2pSendData(session.value, FINISH_CHANNEL, payload)
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
    store.upsertPlayer({
      id: localPeerId.value,
      name,
      color,
      finishTime: existing?.finishTime ?? null
    })
    if (session.value) p2pSendData(session.value, AVATAR_CHANNEL, { name, color })
  }

  const restartGame = (): void => {
    if (!isHost.value || !session.value) return
    p2pSendData(session.value, RESTART_CHANNEL, {})
    const preserved = Object.fromEntries(
      Object.entries(store.players).map(([id, p]) => [id, { ...p, finishTime: null }])
    )
    store.$patch({
      players: preserved,
      phase: 'lobby',
      winnerId: null,
      messages: [],
      raceStartTime: null
    })
  }

  const init = (): void => initSessionForContext(ctx, options.roomId)

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
    broadcastBallPos,
    broadcastFinish,
    broadcastChat,
    updateProfile,
    restartGame,
    init
  }
}
