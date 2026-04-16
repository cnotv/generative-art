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
import {
  chatMessageCreate,
  chatGuessMatches,
  chatGuessIsClose,
  type ChatMessage
} from '@webgamekit/chat'
import { dictionaryPickRandom, type DictionaryDifficulty } from '@webgamekit/dictionary'
import { usePictionaryStore, type PictionaryPlayer } from '@/stores/pictionary'

const INTERMISSION_MS = 10_000
const CHOICE_DURATION_MS = 10_000
const POINTS_FIRST_GUESS = 100
const POINTS_DRAWER = 50
const CHAT_CHANNEL = 'chat'
const STROKE_CHANNEL = 'stroke'
const CLEAR_CHANNEL = 'clear'
const ROUND_CHOICES_CHANNEL = 'round-choices'
const ROUND_CHANNEL = 'round'
const ROUND_END_CHANNEL = 'round-end'
const WORD_CHOICE_COUNT = 3
const SCORE_CHANNEL = 'score'
const AVATAR_CHANNEL = 'avatar'
const HELLO_CHANNEL = 'hello'
const RESTART_CHANNEL = 'restart'
const CONFIG_CHANNEL = 'config'
const HINT_CHANNEL = 'hint'

type PictionaryConfigPayload = {
  totalRounds: number
  roundDuration: number
  wordCount: number
  hintCount: number
  difficulty: DictionaryDifficulty
}

type HintPayload = {
  index: number
}

export type PictionaryStrokePayload = {
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
  size: number
}

export type PictionaryRoundPayload = {
  number: number
  drawerId: string
  word: string
  endsAt: number
}

export type PictionaryChoicesPayload = {
  number: number
  drawerId: string
  choices: string[]
  endsAt: number
}

type ScorePayload = {
  guesserId: string
  drawerId: string
  points: number
  drawerPoints: number
}

type UsePictionarySessionOptions = {
  name: string
  color: string
  roomId: string
  difficulty: DictionaryDifficulty
  onRemoteStroke: (payload: PictionaryStrokePayload) => void
  onRemoteClear: () => void
}

type PictionaryContext = {
  options: UsePictionarySessionOptions
  store: ReturnType<typeof usePictionaryStore>
  session: Ref<P2PSession | null>
  localPeerId: Ref<string>
  guessedPeers: Ref<Set<string>>
  hintTimers: Ref<ReturnType<typeof setTimeout>[]>
  isDrawer: ComputedRef<boolean>
  isHost: ComputedRef<boolean>
  applyRound: (payload: PictionaryRoundPayload) => void
  applyRoundEnd: (intermissionEndsAt?: number | null) => void
  applyChoices: (payload: PictionaryChoicesPayload) => void
  applyRestart: () => void
  endRound: () => void
}

const broadcastConfig = (ctx: PictionaryContext, target: P2PSession): void => {
  const payload: PictionaryConfigPayload = {
    totalRounds: ctx.store.totalRounds,
    roundDuration: ctx.store.roundDuration,
    wordCount: ctx.store.wordCount,
    hintCount: ctx.store.hintCount,
    difficulty: ctx.options.difficulty
  }
  p2pSendData(target, CONFIG_CHANNEL, payload)
}

const clearHintTimers = (ctx: PictionaryContext): void => {
  ctx.hintTimers.value.forEach((timer) => clearTimeout(timer))
  ctx.hintTimers.value = []
}

const revealHint = (ctx: PictionaryContext): void => {
  if (!ctx.session.value) return
  const word = ctx.store.round.word
  if (!word) return
  const letterIndices = [...word]
    .map((char, i) => ({ char, i }))
    .filter(({ char }) => char !== ' ')
    .map(({ i }) => i)
  const remaining = letterIndices.filter((i) => !ctx.store.revealedHintIndices.includes(i))
  if (remaining.length === 0) return
  const pick = remaining[Math.floor(Math.random() * remaining.length)]
  ctx.store.revealedHintIndices = [...ctx.store.revealedHintIndices, pick]
  p2pSendData(ctx.session.value, HINT_CHANNEL, { index: pick })
}

const scheduleHints = (ctx: PictionaryContext): void => {
  clearHintTimers(ctx)
  if (!ctx.isHost.value) return
  const totalMs = ctx.store.roundDuration * 1000
  const count = ctx.store.hintCount
  if (count <= 0) return
  const interval = totalMs / (count + 1)
  ctx.hintTimers.value = Array.from({ length: count }, (_, i) =>
    setTimeout(() => revealHint(ctx), Math.round(interval * (i + 1)))
  )
}

const startRoundForContext = (ctx: PictionaryContext): void => {
  if (!ctx.session.value) return
  const ids = Object.keys(ctx.store.players).sort()
  if (ids.length < 2) return
  broadcastConfig(ctx, ctx.session.value)
  const nextNumber = ctx.store.round.number + 1
  const drawerId = ids[(nextNumber - 1) % ids.length]
  const buildChoice = (): string =>
    Array.from({ length: ctx.store.wordCount }, () =>
      dictionaryPickRandom(ctx.options.difficulty)
    ).join(' ')
  const choices = [...new Set(Array.from({ length: WORD_CHOICE_COUNT * 3 }, buildChoice))].slice(
    0,
    WORD_CHOICE_COUNT
  )
  const payload: PictionaryChoicesPayload = {
    number: nextNumber,
    drawerId,
    choices,
    endsAt: Date.now() + CHOICE_DURATION_MS
  }
  ctx.applyChoices(payload)
  p2pSendData(ctx.session.value, ROUND_CHOICES_CHANNEL, payload)
}

const pickWordForContext = (ctx: PictionaryContext, word: string): void => {
  if (!ctx.session.value) return
  if (!ctx.store.round.choices.includes(word)) return
  const payload: PictionaryRoundPayload = {
    number: ctx.store.round.number,
    drawerId: ctx.store.round.drawerId,
    word,
    endsAt: Date.now() + ctx.store.roundDuration * 1000
  }
  ctx.applyRound(payload)
  p2pSendData(ctx.session.value, ROUND_CHANNEL, payload)
}

const restartGameForContext = (ctx: PictionaryContext, startRound: () => void): void => {
  if (!ctx.session.value) return
  p2pSendData(ctx.session.value, RESTART_CHANNEL, { ts: Date.now() })
  ctx.applyRestart()
  startRound()
}

const updateProfileForContext = (ctx: PictionaryContext, name: string, color: string): void => {
  ctx.options.name = name
  ctx.options.color = color
  const existing = ctx.store.players[ctx.localPeerId.value]
  ctx.store.upsertPlayer({
    id: ctx.localPeerId.value,
    name,
    color,
    score: existing?.score ?? 0
  })
  if (ctx.session.value) {
    p2pSendData(ctx.session.value, AVATAR_CHANNEL, { name, color })
  }
}

const announceSelf = (ctx: PictionaryContext, joined: P2PSession): void => {
  const player: PictionaryPlayer = {
    id: joined.peerId,
    name: ctx.options.name,
    color: ctx.options.color,
    score: 0
  }
  ctx.store.upsertPlayer(player)
  p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
}

const handleCorrectGuess = (ctx: PictionaryContext): void => {
  if (!ctx.session.value) return
  ctx.guessedPeers.value.add(ctx.localPeerId.value)
  const systemMessage: ChatMessage = {
    id: crypto.randomUUID(),
    senderId: 'system',
    senderName: 'System',
    text: `${ctx.options.name} guessed the word!`,
    timestamp: Date.now(),
    kind: 'success'
  }
  ctx.store.appendMessage(systemMessage)
  p2pSendData(ctx.session.value, CHAT_CHANNEL, systemMessage)
  p2pSendData(ctx.session.value, SCORE_CHANNEL, {
    guesserId: ctx.localPeerId.value,
    drawerId: ctx.store.round.drawerId,
    points: POINTS_FIRST_GUESS,
    drawerPoints: POINTS_DRAWER
  })
  ctx.store.addScore(ctx.localPeerId.value, POINTS_FIRST_GUESS)
  ctx.store.addScore(ctx.store.round.drawerId, POINTS_DRAWER)
  if (ctx.isHost.value) ctx.endRound()
}

const sendChat = (ctx: PictionaryContext, text: string): void => {
  if (!ctx.session.value) return
  const message = chatMessageCreate(ctx.localPeerId.value, ctx.options.name, text)
  if (!message) return
  const targetWord = ctx.store.round.word
  const alreadyGuessed = ctx.guessedPeers.value.has(ctx.localPeerId.value)
  const canGuess = !ctx.isDrawer.value && !!targetWord && !alreadyGuessed
  if (canGuess && chatGuessMatches(text, targetWord)) {
    handleCorrectGuess(ctx)
    return
  }
  ctx.store.appendMessage(message)
  p2pSendData(ctx.session.value, CHAT_CHANNEL, message)
  if (canGuess && chatGuessIsClose(text, targetWord)) {
    const closeMessage: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: 'system',
      senderName: 'System',
      text: `${ctx.options.name} is very close!`,
      timestamp: Date.now(),
      kind: 'system'
    }
    ctx.store.appendMessage(closeMessage)
    p2pSendData(ctx.session.value, CHAT_CHANNEL, closeMessage)
  }
}

const bindPeerEvents = (ctx: PictionaryContext, joined: P2PSession): void => {
  p2pOnPeerJoin(joined, (peerId) => {
    p2pSendData(joined, AVATAR_CHANNEL, { name: ctx.options.name, color: ctx.options.color })
    p2pSendData(joined, HELLO_CHANNEL, { id: peerId })
    if (ctx.isHost.value) broadcastConfig(ctx, joined)
  })
  p2pOnPeerLeave(joined, (peerId) => ctx.store.removePlayer(peerId))
  p2pOnData<{ name: string; color: string }>(joined, AVATAR_CHANNEL, (payload, peerId) => {
    const existing = ctx.store.players[peerId]
    ctx.store.upsertPlayer({
      id: peerId,
      name: payload.name,
      color: payload.color,
      score: existing?.score ?? 0
    })
  })
  p2pOnData<PictionaryConfigPayload>(joined, CONFIG_CHANNEL, (payload) => {
    ctx.store.totalRounds = payload.totalRounds
    ctx.store.roundDuration = payload.roundDuration
    ctx.store.wordCount = payload.wordCount
    ctx.store.hintCount = payload.hintCount
    ctx.options.difficulty = payload.difficulty
  })
}

const bindDrawingEvents = (ctx: PictionaryContext, joined: P2PSession): void => {
  p2pOnData<ChatMessage>(joined, CHAT_CHANNEL, (message) => ctx.store.appendMessage(message))
  p2pOnData<PictionaryStrokePayload>(joined, STROKE_CHANNEL, (payload, peerId) => {
    if (peerId !== ctx.store.round.drawerId) return
    ctx.options.onRemoteStroke(payload)
  })
  p2pOnData<{ ts: number }>(joined, CLEAR_CHANNEL, (_payload, peerId) => {
    if (peerId !== ctx.store.round.drawerId) return
    ctx.options.onRemoteClear()
  })
}

const endRoundForContext = (ctx: PictionaryContext, startRound: () => void): void => {
  if (!ctx.session.value || !ctx.isHost.value) return
  clearHintTimers(ctx)
  const intermissionEndsAt = Date.now() + INTERMISSION_MS
  p2pSendData(ctx.session.value, ROUND_END_CHANNEL, {
    number: ctx.store.round.number,
    intermissionEndsAt
  })
  ctx.applyRoundEnd(intermissionEndsAt)
  if (ctx.store.phase === 'intermission') {
    setTimeout(() => {
      if (ctx.store.phase === 'intermission' && ctx.isHost.value) startRound()
    }, INTERMISSION_MS)
  }
}

const initSessionForContext = (ctx: PictionaryContext, roomId: string): void => {
  if (!p2pIsSupported()) return
  const joined = p2pJoin(roomId)
  ctx.session.value = joined
  ctx.localPeerId.value = joined.peerId
  announceSelf(ctx, joined)
  bindPeerEvents(ctx, joined)
  bindDrawingEvents(ctx, joined)
  bindRoundEvents(ctx, joined)
}

const bindRoundEvents = (ctx: PictionaryContext, joined: P2PSession): void => {
  p2pOnData<PictionaryChoicesPayload>(joined, ROUND_CHOICES_CHANNEL, (payload) =>
    ctx.applyChoices(payload)
  )
  p2pOnData<PictionaryRoundPayload>(joined, ROUND_CHANNEL, (payload) => ctx.applyRound(payload))
  p2pOnData<{ number: number; intermissionEndsAt?: number }>(joined, ROUND_END_CHANNEL, (payload) =>
    ctx.applyRoundEnd(payload.intermissionEndsAt ?? null)
  )
  p2pOnData<ScorePayload>(joined, SCORE_CHANNEL, (payload) => {
    ctx.store.addScore(payload.guesserId, payload.points)
    ctx.store.addScore(payload.drawerId, payload.drawerPoints)
    ctx.guessedPeers.value.add(payload.guesserId)
    if (ctx.isHost.value) ctx.endRound()
  })
  p2pOnData<HintPayload>(joined, HINT_CHANNEL, (payload) => {
    if (!ctx.store.revealedHintIndices.includes(payload.index)) {
      ctx.store.revealedHintIndices = [...ctx.store.revealedHintIndices, payload.index]
    }
  })
  p2pOnData<{ ts: number }>(joined, RESTART_CHANNEL, () => ctx.applyRestart())
}

/**
 * Manage a Pictionary multiplayer session (peers, chat, round, scoring).
 * @param options - Session configuration and remote drawing callbacks.
 * @returns Session controls and reactive state for the consuming view.
 */
export const usePictionarySession = (options: UsePictionarySessionOptions) => {
  const store = usePictionaryStore()
  const session = ref<P2PSession | null>(null)
  const localPeerId = ref<string>('')
  const guessedPeers = ref<Set<string>>(new Set())
  const isHost = computed(() => store.hostId === localPeerId.value && localPeerId.value !== '')
  const isDrawer = computed(() => store.round.drawerId === localPeerId.value)

  const applyRound = (payload: PictionaryRoundPayload): void => {
    store.round = { ...payload, choices: [] }
    store.phase = 'drawing'
    store.revealedHintIndices = []
    guessedPeers.value = new Set()
    options.onRemoteClear()
    scheduleHints(ctx)
  }

  const applyChoices = (payload: PictionaryChoicesPayload): void => {
    store.round = {
      number: payload.number,
      drawerId: payload.drawerId,
      word: null,
      endsAt: payload.endsAt,
      choices: payload.choices
    }
    store.phase = 'choosing'
  }

  const applyRoundEnd = (intermissionEndsAt: number | null = null): void => {
    if (store.round.number >= store.totalRounds) {
      store.winnerId = store.playerList[0]?.id ?? null
      store.phase = 'summary'
      store.intermissionEndsAt = null
    } else {
      store.phase = 'intermission'
      store.intermissionEndsAt = intermissionEndsAt ?? Date.now() + INTERMISSION_MS
    }
  }

  const startRound = (): void => {
    if (!isHost.value) return
    startRoundForContext(ctx)
  }

  const applyRestart = (): void => {
    const preserved = Object.fromEntries(
      Object.entries(store.players).map(([id, p]) => [id, { ...p, score: 0 }])
    )
    store.$patch({
      players: preserved,
      phase: 'lobby',
      round: { number: 0, drawerId: '', word: null, endsAt: null, choices: [] },
      winnerId: null,
      intermissionEndsAt: null,
      revealedHintIndices: [],
      messages: []
    })
    guessedPeers.value = new Set()
    clearHintTimers(ctx)
  }

  const endRound = (): void => endRoundForContext(ctx, startRound)

  const hintTimers = ref<ReturnType<typeof setTimeout>[]>([])
  const ctx: PictionaryContext = {
    options,
    store,
    session,
    localPeerId,
    guessedPeers,
    hintTimers,
    isDrawer,
    isHost,
    applyRound,
    applyRoundEnd,
    applyChoices,
    applyRestart,
    endRound
  }

  const broadcastChat = (text: string): void => sendChat(ctx, text)

  const broadcastStroke = (payload: PictionaryStrokePayload): void => {
    if (!session.value || !isDrawer.value) return
    p2pSendData(session.value, STROKE_CHANNEL, payload)
  }

  const broadcastClear = (): void => {
    if (!session.value || !isDrawer.value) return
    p2pSendData(session.value, CLEAR_CHANNEL, { ts: Date.now() })
  }

  const pickWord = (word: string): void => {
    if (!isDrawer.value) return
    pickWordForContext(ctx, word)
  }

  const updateProfile = (name: string, color: string): void =>
    updateProfileForContext(ctx, name, color)

  const restartGame = (): void => {
    if (!isHost.value) return
    restartGameForContext(ctx, startRound)
  }

  const init = (): void => initSessionForContext(ctx, options.roomId)

  const destroy = (): void => {
    clearHintTimers(ctx)
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
    isDrawer,
    broadcastChat,
    broadcastStroke,
    broadcastClear,
    startRound,
    pickWord,
    endRound,
    updateProfile,
    restartGame,
    init,
    destroy
  }
}
