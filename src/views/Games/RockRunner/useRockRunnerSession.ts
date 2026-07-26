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
import { useRockRunnerStore } from '@/stores/rockRunner'
import { MATCHMAKER_ROOM } from './config'
import type {
  RrAvatarPayload,
  RrStartPayload,
  RrDistancePayload,
  RockPosPayload,
  UseRockRunnerSessionOptions,
  RrSessionCallbacks
} from './types'

const AVATAR_CHANNEL = 'rr-avatar'
const START_CHANNEL = 'rr-start'
const ROCK_POS_CHANNEL = 'rr-rock-pos'
const DISTANCE_CHANNEL = 'rr-distance'
const CHAT_CHANNEL = 'rr-chat'
const LOBBY_CHANNEL = 'rr-lobby'

const REANNOUNCE_DELAY_MS = 2000

type SessionContext = {
  options: UseRockRunnerSessionOptions
  store: ReturnType<typeof useRockRunnerStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
  callbacks: RrSessionCallbacks
}

const avatarPayload = (options: UseRockRunnerSessionOptions): RrAvatarPayload => ({
  name: options.name,
  color: options.color
})

const announceSelf = (context: SessionContext, joined: P2PSession): void => {
  context.store.upsertPlayer({
    id: joined.peerId,
    name: context.options.name,
    color: context.options.color,
    distance: 0
  })
  p2pSendData(joined, AVATAR_CHANNEL, avatarPayload(context.options))
  setTimeout(() => {
    if (context.session.value) {
      p2pSendData(joined, AVATAR_CHANNEL, avatarPayload(context.options))
    }
  }, REANNOUNCE_DELAY_MS)
}

const bindPeerEvents = (context: SessionContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, () => {
    p2pSendData(joined, AVATAR_CHANNEL, avatarPayload(context.options))
  })

  p2pOnPeerLeave(joined, (peerId) => {
    const player = context.store.players[peerId]
    if (player) {
      context.store.appendMessage({
        id: crypto.randomUUID(),
        senderId: 'system',
        senderName: 'System',
        text: `${player.name} left the room`,
        timestamp: Date.now(),
        kind: 'system'
      })
    }
    context.store.removePlayer(peerId)
  })

  p2pOnData<RrAvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    const existing = context.store.players[peerId]
    context.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      distance: existing?.distance ?? 0
    })
  })
}

const bindGameEvents = (context: SessionContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => context.store.appendMessage(message))

  // The track is generated from the seed alone, so the host broadcasts a number
  // rather than any geometry and every peer runs an identical world.
  p2pOnData<RrStartPayload>(joined, START_CHANNEL, (payload) => {
    context.callbacks.onSeedReceived(payload.seed)
    context.store.clearDistances()
    context.store.trackSeed = payload.seed
    context.store.runStartTime = payload.timestamp
    context.store.phase = 'run'
  })

  p2pOnData<RockPosPayload>(joined, ROCK_POS_CHANNEL, (payload, peerId) => {
    context.store.setDistance(peerId, payload.d)
    context.callbacks.onRockPos(peerId, payload)
  })

  p2pOnData<RrDistancePayload>(joined, DISTANCE_CHANNEL, (payload) => {
    context.store.setDistance(payload.playerId, payload.distance)
  })

  p2pOnData(joined, LOBBY_CHANNEL, () => {
    context.store.phase = 'lobby'
  })
}

/**
 * P2P session for the rock runner: seed distribution so every peer generates
 * the same endless track, plus live rock positions, distances and chat.
 *
 * @param options - Local player identity and room
 * @param callbacks - Hooks for remote rock positions and seed changes
 * @returns Session state and broadcast helpers
 */
export const useRockRunnerSession = (
  options: UseRockRunnerSessionOptions,
  callbacks: RrSessionCallbacks
) => {
  const store = useRockRunnerStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const context: SessionContext = { options, store, session, localPeerId, isHost, callbacks }

  const startRun = (seed: number): void => {
    const timestamp = Date.now()
    store.clearDistances()
    store.trackSeed = seed
    store.runStartTime = timestamp
    store.phase = 'run'
    if (session.value) {
      const payload: RrStartPayload = { timestamp, seed }
      p2pSendData(session.value, START_CHANNEL, payload)
    }
  }

  const returnToLobby = (): void => {
    store.phase = 'lobby'
    if (session.value) p2pSendData(session.value, LOBBY_CHANNEL, {})
  }

  const broadcastRockPos = (pos: RockPosPayload): void => {
    if (session.value) p2pSendData(session.value, ROCK_POS_CHANNEL, pos)
  }

  const broadcastDistance = (distance: number): void => {
    if (!session.value) return
    const payload: RrDistancePayload = { playerId: localPeerId.value, distance }
    p2pSendData(session.value, DISTANCE_CHANNEL, payload)
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
      distance: existing?.distance ?? 0
    })
    if (session.value) p2pSendData(session.value, AVATAR_CHANNEL, avatarPayload(options))
  }

  const init = (): void => {
    if (!p2pIsSupported()) return
    const joined = p2pJoin(options.roomId)
    session.value = joined
    localPeerId.value = joined.peerId
    announceSelf(context, joined)
    bindPeerEvents(context, joined)
    bindGameEvents(context, joined)
  }

  const destroy = (): void => {
    if (session.value) {
      p2pLeave(session.value)
      session.value = null
    }
    store.reset()
  }

  const reconnect = (newRoomId: string): void => {
    destroy()
    options.roomId = newRoomId
    init()
  }

  onUnmounted(destroy)

  return {
    session,
    localPeerId,
    isHost,
    matchmakerRoom: MATCHMAKER_ROOM,
    startRun,
    returnToLobby,
    broadcastRockPos,
    broadcastDistance,
    broadcastChat,
    updateProfile,
    reconnect,
    init,
    destroy
  }
}
