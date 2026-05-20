import { type ComputedRef, type Ref } from 'vue'
import { p2pSendData, p2pOnData, type P2PSession } from '@webgamekit/multiplayer-p2p'
import { useBaseMultiplayerSession } from '@/composables/useBaseMultiplayerSession'
import { useRhythmGameStore, type RgPlayer, type RgScore } from '@/stores/rhythmGame'
import { MATCHMAKER_ROOM } from './config'
import type { RgSong, RgDifficulty, RgInstrument } from './config'

const AVATAR_CHANNEL = 'rg-avatar'
const CONFIG_CHANNEL = 'rg-config'
const START_CHANNEL = 'rg-start'
const SCORE_CHANNEL = 'rg-score'
const GAMEOVER_CHANNEL = 'rg-gameover'
const CHAT_CHANNEL = 'rg-chat'
const RESTART_CHANNEL = 'rg-restart'

type SessionOptions = { name: string; color: string; roomId: string }
type StartPayload = { song: RgSong; difficulty: RgDifficulty; startAt: number }
type ScorePayload = RgScore

const makeSelfPlayer = (peerId: string, options: SessionOptions): RgPlayer => ({
  id: peerId,
  name: options.name,
  color: options.color,
  score: 0,
  combo: 0,
  maxCombo: 0,
  perfect: 0,
  good: 0,
  miss: 0
})

const makePeerPlayer = (
  peerId: string,
  data: { name: string; color: string },
  existing: RgPlayer | undefined
): RgPlayer => ({
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

const bindGameData = (
  s: P2PSession,
  _localPeerId: Ref<string>,
  isHost: ComputedRef<boolean>,
  store: ReturnType<typeof useRhythmGameStore>,
  onStartCallback: { current: ((payload: StartPayload) => void) | null }
): void => {
  p2pOnData(
    s,
    CONFIG_CHANNEL,
    (data: { song: RgSong; difficulty: RgDifficulty; instrument: RgInstrument }) => {
      store.song = data.song ?? 'electric-pulse'
      store.difficulty = data.difficulty ?? 'medium'
      store.instrument = data.instrument ?? 'piano'
    }
  )

  p2pOnData(s, START_CHANNEL, (data: StartPayload) => {
    store.phase = 'playing'
    onStartCallback.current?.(data)
  })

  p2pOnData(s, SCORE_CHANNEL, (data: ScorePayload, peerId) => {
    store.updateScore(peerId, data)
  })

  p2pOnData(s, GAMEOVER_CHANNEL, (_data, peerId) => {
    const others = store.playerList.filter((p) => p.id !== peerId)
    if (others.length > 0) store.winnerId = others[0].id
    store.phase = 'summary'
  })
}

/**
 * Manage a RhythmGame multiplayer session (peers, chat, score, game lifecycle).
 * @param options - Session configuration including player name, color, and room ID.
 * @returns Session controls and reactive state for the consuming view.
 */
export const useRhythmGameSession = (options: SessionOptions) => {
  const store = useRhythmGameStore()
  const onStartCallback: { current: ((payload: StartPayload) => void) | null } = { current: null }

  const base = useBaseMultiplayerSession<RgPlayer>({
    roomId: options.roomId,
    matchmakerRoom: MATCHMAKER_ROOM,
    channels: { avatar: AVATAR_CHANNEL, chat: CHAT_CHANNEL, restart: RESTART_CHANNEL },
    getProfile: () => ({ name: options.name, color: options.color }),
    setProfile: (name, color) => {
      options.name = name
      options.color = color
    },
    getHostId: () => store.hostId,
    getPlayer: (peerId) => store.players[peerId],
    onUpsertPlayer: (player) => store.upsertPlayer(player),
    onRemovePlayer: (peerId) => store.removePlayer(peerId),
    onAppendMessage: (message) => store.appendMessage(message),
    makeSelfPlayer: (peerId) => makeSelfPlayer(peerId, options),
    makePeerPlayer,
    onPeerJoin: (s, isHost) => {
      if (isHost.value) {
        p2pSendData(s, CONFIG_CHANNEL, {
          song: store.song,
          difficulty: store.difficulty,
          instrument: store.instrument
        })
      }
    },
    onData: (s, localPeerId, isHost) =>
      bindGameData(s, localPeerId, isHost, store, onStartCallback),
    onRestart: () => {
      store.reset()
      store.phase = 'lobby'
    }
  })

  const { session, localPeerId, isHost } = base

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

  const onStart = (callback: (payload: StartPayload) => void): void => {
    onStartCallback.current = callback
  }

  return {
    ...base,
    isHost,
    localPeerId,
    startGame,
    broadcastScore,
    broadcastGameOver,
    onStart
  }
}
