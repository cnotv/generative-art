import { computed, onUnmounted, ref, type ComputedRef, type Ref } from 'vue'
import {
  p2pIsSupported,
  p2pJoin,
  p2pLeave,
  p2pOnData,
  p2pOnPeerJoin,
  p2pOnPeerLeave,
  p2pSendData,
  type P2PSession
} from '@webgamekit/multiplayer-p2p'
import { chatMessageCreate, type ChatMessage } from '@webgamekit/chat'
import { useWordRunnerStore } from '@/stores/wordRunner'
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from './config'
import { oneOf } from './game/preferences'
import type {
  Difficulty,
  WrAvatarPayload,
  WrFinishPayload,
  WrProgressPayload,
  WrSessionOptions,
  WrStartPayload
} from './types'

const AVATAR_CHANNEL = 'wr-avatar'
const START_CHANNEL = 'wr-start'
const READY_CHANNEL = 'wr-ready'
const GO_CHANNEL = 'wr-go'
const PROGRESS_CHANNEL = 'wr-progress'
const FINISH_CHANNEL = 'wr-finish'
const CHAT_CHANNEL = 'wr-chat'
const LOBBY_CHANNEL = 'wr-lobby'

const REANNOUNCE_DELAY_MS = 2000

type SessionCallbacks = {
  /** Every ball in the room may roll: the host has seen everyone load the course. */
  onGo: () => void
}

type SessionContext = {
  options: WrSessionOptions
  store: ReturnType<typeof useWordRunnerStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
  callbacks: SessionCallbacks
}

const avatarPayload = (options: WrSessionOptions): WrAvatarPayload => ({
  name: options.name,
  color: options.color
})

const announceSelf = (context: SessionContext, joined: P2PSession): void => {
  context.store.upsertPlayer({
    id: joined.peerId,
    name: context.options.name,
    color: context.options.color
  })
  p2pSendData(joined, AVATAR_CHANNEL, avatarPayload(context.options))
  // A peer joining at the same moment can miss the first announcement.
  setTimeout(() => {
    if (context.session.value) {
      p2pSendData(joined, AVATAR_CHANNEL, avatarPayload(context.options))
    }
  }, REANNOUNCE_DELAY_MS)
}

const systemMessage = (text: string): ChatMessage => ({
  id: crypto.randomUUID(),
  senderId: 'system',
  senderName: 'System',
  text,
  timestamp: Date.now(),
  kind: 'system'
})

const bindPeerEvents = (context: SessionContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, () => p2pSendData(joined, AVATAR_CHANNEL, avatarPayload(context.options)))
  p2pOnPeerLeave(joined, (peerId) => {
    const player = context.store.players[peerId]
    if (player) context.store.appendMessage(systemMessage(`${player.name} left the room`))
    context.store.removePlayer(peerId)
  })
  p2pOnData<WrAvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) =>
    context.store.upsertPlayer({ id: peerId, name: payload.name, color: payload.color })
  )
}

const bindRaceEvents = (context: SessionContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => context.store.appendMessage(message))
  // A level is laid out from its id alone, so naming it and its speed is all every peer needs.
  p2pOnData<WrStartPayload>(joined, START_CHANNEL, (payload) => {
    context.store.solo = false
    context.store.startRace(
      payload.levelId,
      oneOf(payload.difficulty, DIFFICULTIES, DEFAULT_DIFFICULTY)
    )
  })
  p2pOnData(joined, READY_CHANNEL, (_payload, peerId) => context.store.setReady(peerId))
  p2pOnData(joined, GO_CHANNEL, () => context.callbacks.onGo())
  p2pOnData<WrProgressPayload>(joined, PROGRESS_CHANNEL, (payload, peerId) =>
    context.store.setProgress(peerId, payload.distance, payload.lateral)
  )
  p2pOnData<WrFinishPayload>(joined, FINISH_CHANNEL, (payload, peerId) =>
    context.store.setFinish(peerId, payload.seconds)
  )
  p2pOnData(joined, LOBBY_CHANNEL, () => {
    context.store.phase = 'lobby'
  })
}

/**
 * The P2P session for a Word Runner room: who is in it, which level the host starts, when
 * everyone has loaded it, and where every ball is until it crosses the line. Chat too.
 */
export const useWordRunnerSession = (options: WrSessionOptions, callbacks: SessionCallbacks) => {
  const store = useWordRunnerStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')
  const context: SessionContext = { options, store, session, localPeerId, isHost, callbacks }

  const send = (channel: string, payload: Parameters<typeof p2pSendData>[2]): void => {
    if (session.value) p2pSendData(session.value, channel, payload)
  }

  const startRace = (levelId: string, difficulty: Difficulty): void => {
    store.startRace(levelId, difficulty)
    const payload: WrStartPayload = { levelId, difficulty }
    send(START_CHANNEL, payload)
  }

  const markReady = (): void => {
    if (localPeerId.value) store.setReady(localPeerId.value)
    send(READY_CHANNEL, {})
  }

  /** The host lets every ball roll at once, its own included. */
  const go = (): void => {
    send(GO_CHANNEL, {})
    callbacks.onGo()
  }

  const broadcastProgress = (distance: number, lateral: number): void => {
    if (localPeerId.value) store.setProgress(localPeerId.value, distance, lateral)
    const payload: WrProgressPayload = { distance, lateral }
    send(PROGRESS_CHANNEL, payload)
  }

  const broadcastFinish = (seconds: number): void => {
    if (localPeerId.value) store.setFinish(localPeerId.value, seconds)
    const payload: WrFinishPayload = { seconds }
    send(FINISH_CHANNEL, payload)
  }

  const returnToLobby = (): void => {
    store.phase = 'lobby'
    send(LOBBY_CHANNEL, {})
  }

  const broadcastChat = (text: string): void => {
    const message = chatMessageCreate(localPeerId.value, options.name, text)
    if (!session.value || !message) return
    store.appendMessage(message)
    send(CHAT_CHANNEL, message)
  }

  const updateProfile = (name: string, color: string): void => {
    options.name = name
    options.color = color
    if (localPeerId.value) store.upsertPlayer({ id: localPeerId.value, name, color })
    send(AVATAR_CHANNEL, avatarPayload(options))
  }

  const init = (): void => {
    if (!p2pIsSupported()) return
    const joined = p2pJoin(options.roomId)
    session.value = joined
    localPeerId.value = joined.peerId
    announceSelf(context, joined)
    bindPeerEvents(context, joined)
    bindRaceEvents(context, joined)
  }

  const destroy = (): void => {
    if (session.value) p2pLeave(session.value)
    session.value = null
    store.reset()
  }

  const reconnect = (roomId: string): void => {
    destroy()
    options.roomId = roomId
    init()
  }

  onUnmounted(destroy)

  return {
    localPeerId,
    isHost,
    startRace,
    markReady,
    go,
    broadcastProgress,
    broadcastFinish,
    returnToLobby,
    broadcastChat,
    updateProfile,
    reconnect,
    init,
    destroy
  }
}
