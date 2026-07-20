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
import { useMarbleEditorStore } from '@/stores/marbleEditor'
import { MATCHMAKER_ROOM } from './config'
import type {
  MeAvatarPayload,
  MeMapPayload,
  MeStartPayload,
  MeFinishPayload,
  MeRestartPayload,
  BallPosPayload,
  UseMarbleEditorSessionOptions,
  MeSessionCallbacks
} from './types'

const AVATAR_CHANNEL = 'me-avatar'
const MAP_CHANNEL = 'me-map'
const START_CHANNEL = 'me-start'
const BALL_POS_CHANNEL = 'me-ball-pos'
const FINISH_CHANNEL = 'me-finish'
const CHAT_CHANNEL = 'me-chat'
const RESTART_CHANNEL = 'me-restart'
const EDIT_CHANNEL = 'me-edit'

const REANNOUNCE_DELAY_MS = 2000

type SessionContext = {
  options: UseMarbleEditorSessionOptions
  store: ReturnType<typeof useMarbleEditorStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  isHost: ComputedRef<boolean>
  callbacks: MeSessionCallbacks
}

const avatarPayload = (options: UseMarbleEditorSessionOptions): MeAvatarPayload => ({
  name: options.name,
  color: options.color,
  marble: options.marble
})

const announceSelf = (context: SessionContext, joined: P2PSession): void => {
  context.store.upsertPlayer({
    id: joined.peerId,
    name: context.options.name,
    color: context.options.color,
    marble: context.options.marble,
    finishTime: null
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
    if (context.isHost.value) {
      p2pSendData(joined, MAP_CHANNEL, { map: context.callbacks.getCurrentMap() })
    }
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

  p2pOnData<MeAvatarPayload>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    const existing = context.store.players[peerId]
    context.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      marble: payload.marble,
      finishTime: existing?.finishTime ?? null
    })
  })
}

const bindGameEvents = (context: SessionContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => context.store.appendMessage(message))

  p2pOnData<MeMapPayload>(joined, MAP_CHANNEL, (payload) => {
    context.callbacks.onMapReceived(payload.map)
  })

  p2pOnData<MeStartPayload>(joined, START_CHANNEL, (payload) => {
    context.callbacks.onMapReceived(payload.map)
    context.store.clearFinishTimes()
    context.store.winnerId = null
    context.store.raceStartTime = payload.timestamp
    context.store.phase = 'race'
  })

  p2pOnData<BallPosPayload>(joined, BALL_POS_CHANNEL, (payload, peerId) => {
    context.callbacks.onBallPos(peerId, payload)
  })

  p2pOnData<MeFinishPayload>(joined, FINISH_CHANNEL, (payload) => {
    context.store.setFinishTime(payload.playerId, payload.time)
    if (!context.store.winnerId) context.store.winnerId = payload.playerId
  })

  p2pOnData<MeRestartPayload>(joined, RESTART_CHANNEL, (payload) => {
    context.store.clearFinishTimes()
    context.store.winnerId = null
    context.store.raceStartTime = payload.timestamp
    context.store.phase = 'race'
  })

  p2pOnData(joined, EDIT_CHANNEL, () => {
    context.store.phase = 'edit'
  })
}

/**
 * P2P session for the marble editor: live collaborative map editing plus race
 * synchronization (start, marble positions, finishes, restart, chat).
 */
export const useMarbleEditorSession = (
  options: UseMarbleEditorSessionOptions,
  callbacks: MeSessionCallbacks
) => {
  const store = useMarbleEditorStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')

  const context: SessionContext = { options, store, session, localPeerId, isHost, callbacks }

  const broadcastMap = (mapPayload: MeMapPayload): void => {
    if (!session.value) return
    p2pSendData(session.value, MAP_CHANNEL, mapPayload)
  }

  const startRace = (): void => {
    const timestamp = Date.now()
    store.clearFinishTimes()
    store.winnerId = null
    store.raceStartTime = timestamp
    store.phase = 'race'
    if (session.value) {
      const payload: MeStartPayload = { timestamp, map: callbacks.getCurrentMap() }
      p2pSendData(session.value, START_CHANNEL, payload)
    }
  }

  const restartRace = (): void => {
    const timestamp = Date.now()
    store.clearFinishTimes()
    store.winnerId = null
    store.raceStartTime = timestamp
    store.phase = 'race'
    if (session.value) p2pSendData(session.value, RESTART_CHANNEL, { timestamp })
  }

  const returnToEdit = (): void => {
    store.phase = 'edit'
    if (session.value) p2pSendData(session.value, EDIT_CHANNEL, {})
  }

  const broadcastBallPos = (pos: BallPosPayload): void => {
    if (session.value) p2pSendData(session.value, BALL_POS_CHANNEL, pos)
  }

  const broadcastFinish = (time: number): void => {
    if (!session.value) return
    const payload: MeFinishPayload = { playerId: localPeerId.value, time }
    p2pSendData(session.value, FINISH_CHANNEL, payload)
  }

  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const message = chatMessageCreate(localPeerId.value, options.name, text)
    if (!message) return
    store.appendMessage(message)
    p2pSendData(session.value, CHAT_CHANNEL, message)
  }

  const updateProfile = (name: string, color: string, marble?: string): void => {
    options.name = name
    options.color = color
    if (marble !== undefined) options.marble = marble
    const existing = store.players[localPeerId.value]
    store.upsertPlayer({
      id: localPeerId.value,
      name,
      color,
      marble: options.marble,
      finishTime: existing?.finishTime ?? null
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
    broadcastMap,
    startRace,
    restartRace,
    returnToEdit,
    broadcastBallPos,
    broadcastFinish,
    broadcastChat,
    updateProfile,
    reconnect,
    init,
    destroy
  }
}
