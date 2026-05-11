import { ref, onUnmounted } from 'vue'
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
import { useLobbyStore } from '@/stores/lobby'
import type { LobbyRoom } from '@/types/lobby'
import { LOBBY_CHANNEL, REANNOUNCE_MS } from './constants'

const HELLO_CHANNEL = 'lb-hello'
const CHAT_CHANNEL = 'lb-chat'
const ROOM_CHANNEL = 'lb-room'
const RETRACT_CHANNEL = 'lb-room-retract'

type HelloPayload = { name: string; color: string }
type RetractPayload = { id: string }

export const useLobbySession = (name: string, color: string) => {
  const store = useLobbyStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref('')
  const ownRoom = ref<LobbyRoom | null>(null)
  let reannounceTimer: ReturnType<typeof setInterval> | null = null

  const announceSelf = (target: P2PSession): void => {
    const payload: HelloPayload = { name, color }
    p2pSendData(target, HELLO_CHANNEL, payload)
  }

  const announceRoom = (target: P2PSession, room: LobbyRoom): void => {
    if (!room.isHidden) p2pSendData(target, ROOM_CHANNEL, room)
  }

  const systemMessage = (text: string): void => {
    store.appendMessage({
      id: crypto.randomUUID(),
      senderId: 'system',
      senderName: 'System',
      text,
      timestamp: Date.now(),
      kind: 'system'
    })
  }

  const init = (): void => {
    if (!p2pIsSupported()) return
    const joined = p2pJoin(LOBBY_CHANNEL)
    session.value = joined
    localPeerId.value = joined.peerId

    store.upsertPlayer({ id: joined.peerId, name, color })
    announceSelf(joined)

    p2pOnPeerJoin(joined, (peerId) => {
      p2pSendData(joined, HELLO_CHANNEL, { name, color })
      if (ownRoom.value) announceRoom(joined, ownRoom.value)
      // greet message added once we know their name via lb-hello
      void peerId
    })

    p2pOnPeerLeave(joined, (peerId) => {
      const player = store.players[peerId]
      if (player) systemMessage(`${player.name} left the lobby`)
      store.removePlayer(peerId)
      store.removeRoomsByHost(peerId)
    })

    p2pOnData<HelloPayload>(joined, HELLO_CHANNEL, (payload, peerId) => {
      const isNew = !store.players[peerId]
      store.upsertPlayer({ id: peerId, name: payload.name, color: payload.color })
      if (isNew) systemMessage(`${payload.name} joined the lobby`)
    })

    p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => {
      store.appendMessage(message)
    })

    p2pOnData<LobbyRoom>(joined, ROOM_CHANNEL, (room) => {
      store.upsertRoom(room)
    })

    p2pOnData<RetractPayload>(joined, RETRACT_CHANNEL, (payload) => {
      store.removeRoom(payload.id)
    })

    reannounceTimer = setInterval(() => {
      if (ownRoom.value && session.value) announceRoom(session.value, ownRoom.value)
    }, REANNOUNCE_MS)
  }

  const sendChat = (text: string): void => {
    if (!session.value) return
    const message = chatMessageCreate(localPeerId.value, name, text)
    if (!message) return
    store.appendMessage(message)
    p2pSendData(session.value, CHAT_CHANNEL, message)
  }

  const createRoom = (room: LobbyRoom): void => {
    ownRoom.value = room
    store.upsertRoom(room)
    if (session.value && !room.isHidden) announceRoom(session.value, room)
  }

  const closeRoom = (): void => {
    if (!ownRoom.value || !session.value) return
    p2pSendData(session.value, RETRACT_CHANNEL, { id: ownRoom.value.id })
    store.removeRoom(ownRoom.value.id)
    ownRoom.value = null
  }

  const destroy = (): void => {
    if (reannounceTimer !== null) clearInterval(reannounceTimer)
    closeRoom()
    if (session.value) p2pLeave(session.value)
    session.value = null
    store.reset()
  }

  onUnmounted(destroy)

  return { localPeerId, ownRoom, init, sendChat, createRoom, closeRoom }
}
