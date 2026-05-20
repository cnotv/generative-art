import { ref, computed, onUnmounted, type ComputedRef } from 'vue'
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
import { chatMessageCreate } from '@webgamekit/chat'
import { useRhythmGameStore, type RgPlayer, type RgScore } from '@/stores/rhythmGame'
import { MATCHMAKER_ROOM } from './config'
import type { RgSong, RgDifficulty } from './config'

const AVATAR_CHANNEL = 'rg-avatar'
const CONFIG_CHANNEL = 'rg-config'
const START_CHANNEL = 'rg-start'
const SCORE_CHANNEL = 'rg-score'
const GAMEOVER_CHANNEL = 'rg-gameover'
const CHAT_CHANNEL = 'rg-chat'
const RESTART_CHANNEL = 'rg-restart'

const REANNOUNCE_DELAY_MS = 2000

type SessionOptions = { name: string; color: string; roomId: string }
type StartPayload = { song: RgSong; difficulty: RgDifficulty; startAt: number }
type ScorePayload = RgScore

type BindContext = {
  options: SessionOptions
  isHost: ComputedRef<boolean>
  store: ReturnType<typeof useRhythmGameStore>
  onStartCallback: { current: ((payload: StartPayload) => void) | null }
}

const announceSelf = (
  s: P2PSession,
  options: SessionOptions,
  store: ReturnType<typeof useRhythmGameStore>
): void => {
  const player: RgPlayer = {
    id: s.peerId,
    name: options.name,
    color: options.color,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    good: 0,
    miss: 0
  }
  store.upsertPlayer(player)
  p2pSendData(s, AVATAR_CHANNEL, { name: options.name, color: options.color })
  setTimeout(() => {
    p2pSendData(s, AVATAR_CHANNEL, { name: options.name, color: options.color })
  }, REANNOUNCE_DELAY_MS)
}

const bindData = (s: P2PSession, context: BindContext): void => {
  const { options, isHost, store, onStartCallback } = context

  p2pOnPeerJoin(s, () => {
    p2pSendData(s, AVATAR_CHANNEL, { name: options.name, color: options.color })
    if (isHost.value) {
      p2pSendData(s, CONFIG_CHANNEL, { song: store.song, difficulty: store.difficulty })
    }
  })

  p2pOnPeerLeave(s, (peerId) => {
    store.removePlayer(peerId)
  })

  p2pOnData(s, AVATAR_CHANNEL, (peerId, data: { name: string; color: string }) => {
    const existing = store.players[peerId]
    store.upsertPlayer({
      id: peerId,
      name: data.name,
      color: data.color,
      score: existing?.score ?? 0,
      combo: existing?.combo ?? 0,
      maxCombo: existing?.maxCombo ?? 0,
      perfect: existing?.perfect ?? 0,
      good: existing?.good ?? 0,
      miss: existing?.miss ?? 0
    })
  })

  p2pOnData(s, CONFIG_CHANNEL, (_peerId, data: { song: RgSong; difficulty: RgDifficulty }) => {
    store.song = data.song
    store.difficulty = data.difficulty
  })

  p2pOnData(s, START_CHANNEL, (_peerId, data: StartPayload) => {
    store.phase = 'playing'
    onStartCallback.current?.(data)
  })

  p2pOnData(s, SCORE_CHANNEL, (peerId, data: ScorePayload) => {
    store.updateScore(peerId, data)
  })

  p2pOnData(s, GAMEOVER_CHANNEL, (peerId) => {
    const others = store.playerList.filter((p) => p.id !== peerId)
    if (others.length > 0) store.winnerId = others[0].id
    store.phase = 'summary'
  })

  p2pOnData(s, CHAT_CHANNEL, (peerId, data: { text: string }) => {
    const player = store.players[peerId]
    if (!player) return
    store.appendMessage(chatMessageCreate(peerId, player.name, player.color, data.text))
  })

  p2pOnData(s, RESTART_CHANNEL, () => {
    store.reset()
    store.phase = 'lobby'
  })
}

export const useRhythmGameSession = (options: SessionOptions) => {
  const store = useRhythmGameStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref('')
  const isHost = computed(() => !!localPeerId.value && store.hostId === localPeerId.value)

  const onStartCallback: { current: ((payload: StartPayload) => void) | null } = { current: null }

  const init = async (): Promise<void> => {
    if (!p2pIsSupported()) return
    const s = await p2pJoin(options.roomId, MATCHMAKER_ROOM)
    session.value = s
    localPeerId.value = s.peerId
    announceSelf(s, options, store)
    bindData(s, { options, isHost, store, onStartCallback })
  }

  const reconnect = async (newRoomId: string): Promise<void> => {
    if (session.value) p2pLeave(session.value)
    session.value = null
    const s = await p2pJoin(newRoomId, MATCHMAKER_ROOM)
    session.value = s
    localPeerId.value = s.peerId
    announceSelf(s, options, store)
    bindData(s, { options, isHost, store, onStartCallback })
  }

  const updateProfile = (name: string, color: string): void => {
    if (!session.value) return
    options.name = name
    options.color = color
    p2pSendData(session.value, AVATAR_CHANNEL, { name, color })
  }

  const startGame = (): void => {
    if (!session.value) return
    const startAt = Date.now() + 3000
    const payload: StartPayload = { song: store.song, difficulty: store.difficulty, startAt }
    p2pSendData(session.value, START_CHANNEL, payload)
    store.phase = 'playing'
    onStartCallback.current?.(payload)
  }

  const broadcastScore = (data: RgScore): void => {
    if (!session.value) return
    p2pSendData(session.value, SCORE_CHANNEL, data)
  }

  const broadcastGameOver = (): void => {
    if (!session.value) return
    p2pSendData(session.value, GAMEOVER_CHANNEL, {})
  }

  const broadcastChat = (text: string): void => {
    if (!session.value) return
    const player = store.players[localPeerId.value]
    if (!player) return
    store.appendMessage(chatMessageCreate(localPeerId.value, player.name, player.color, text))
    p2pSendData(session.value, CHAT_CHANNEL, { text })
  }

  const restartGame = (): void => {
    if (!session.value) return
    p2pSendData(session.value, RESTART_CHANNEL, {})
    store.reset()
    store.phase = 'lobby'
  }

  const onStart = (callback: (payload: StartPayload) => void): void => {
    onStartCallback.current = callback
  }

  onUnmounted(() => {
    if (session.value) p2pLeave(session.value)
  })

  return {
    isHost,
    localPeerId,
    init,
    reconnect,
    updateProfile,
    startGame,
    broadcastScore,
    broadcastGameOver,
    broadcastChat,
    restartGame,
    onStart
  }
}
