<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Check, RotateCcw } from 'lucide-vue-next'
import { usePictionaryStore } from '@/stores/pictionary'
import { Chat } from '@/components/Chat'
import { type DictionaryDifficulty } from '@webgamekit/dictionary'
import DrawingCanvas, { type StrokeSegment } from './DrawingCanvas.vue'
import { usePictionarySession } from './usePictionarySession'

const PLAYER_COLORS = ['#d32f2f', '#1565c0', '#ef6c00', '#2e7d32', '#6a1b9a', '#ad1457', '#37474f']
const NAME_ADJECTIVES = ['Swift', 'Clever', 'Bold', 'Brave', 'Wild', 'Silent', 'Happy']
const NAME_ANIMALS = ['Fox', 'Otter', 'Panda', 'Hawk', 'Wolf', 'Cat', 'Koala']
const GRADIENT_COLORS = [
  'rgba(255, 217, 61, 0.45)',
  'rgba(255, 107, 203, 0.4)',
  'rgba(78, 205, 196, 0.4)',
  'rgba(255, 140, 66, 0.4)',
  'rgba(160, 108, 213, 0.4)',
  'rgba(107, 207, 127, 0.4)',
  'rgba(72, 219, 251, 0.4)'
]
const GRADIENT_STOP_PERCENT = 45
const GRADIENT_LAYER_COUNT = 4
const GRADIENT_PERCENT_MAX = 100

const randomPick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]
const randomPercent = (): number => Math.round(Math.random() * GRADIENT_PERCENT_MAX)

const buildRandomGradient = (): string => {
  const layers = Array.from({ length: GRADIENT_LAYER_COUNT }, () => {
    const x = randomPercent()
    const y = randomPercent()
    const color = randomPick(GRADIENT_COLORS)
    return `radial-gradient(circle at ${x}% ${y}%, ${color}, transparent ${GRADIENT_STOP_PERCENT}%)`
  })
  return [...layers, '#fff7e6'].join(', ')
}

const route = useRoute()
const router = useRouter()
const store = usePictionaryStore()
const {
  phase,
  round,
  playerList,
  messages,
  winnerId,
  totalRounds,
  roundDuration,
  wordCount,
  hintCount,
  intermissionEndsAt,
  revealedHintIndices
} = storeToRefs(store)
const ROUND_DURATION_OPTIONS = [30, 60, 90, 120, 150]
const WORD_COUNT_OPTIONS = [1, 2, 3]
const HINT_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5]
const POINTS_GUESSER = 100
const POINTS_DRAWER = 50

const playerName = ref(`${randomPick(NAME_ADJECTIVES)}${randomPick(NAME_ANIMALS)}`)
const playerColor = ref(randomPick(PLAYER_COLORS))
const backgroundStyle = { background: buildRandomGradient() }
const difficulty = ref<DictionaryDifficulty>('easy')
const drawingCanvasReference = ref<InstanceType<typeof DrawingCanvas> | null>(null)
const strokeColor = ref('#111111')
const strokeSize = ref(4)
const timeLeft = ref(0)
const intermissionLeft = ref(0)

const resolvedRoomId = ((): string => {
  const existing = route.query.room as string | undefined
  if (existing) return existing
  const next = crypto.randomUUID()
  router.replace({ query: { ...route.query, room: next } })
  return next
})()

const roomId = ref(resolvedRoomId)

const topPlayers = computed(() => {
  const list = playerList.value
  if (list.length === 0) return []
  const top = list[0].score
  return list.filter((player) => player.score === top)
})

const winnerLabel = computed(() => {
  const top = topPlayers.value
  if (top.length === 0) return ''
  if (top.length === 1) return top[0].name
  if (top.length === 2) return `${top[0].name} and ${top[1].name}`
  return `${top
    .slice(0, -1)
    .map((player) => player.name)
    .join(', ')}, and ${top[top.length - 1].name}`
})

const maskedWord = computed(() => {
  const word = round.value.word
  if (!word) return ''
  const indices = new Set(revealedHintIndices.value)
  return [...word].map((char, i) => (char === ' ' ? ' ' : indices.has(i) ? char : '_')).join('')
})

const session = usePictionarySession({
  name: playerName.value,
  color: playerColor.value,
  roomId: resolvedRoomId,
  difficulty: difficulty.value,
  onRemoteStroke: (payload) => {
    drawingCanvasReference.value?.renderSegment(payload)
  },
  onRemoteClear: () => {
    drawingCanvasReference.value?.clearCanvas()
  }
})

const { isHost, isDrawer, localPeerId } = session

const shareableLink = computed(() => {
  if (!roomId.value) return ''
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId.value)
  return url.toString()
})

const copyLink = async (): Promise<void> => {
  if (!shareableLink.value) return
  await navigator.clipboard.writeText(shareableLink.value)
}

const handleChatSend = (text: string): void => {
  session.broadcastChat(text)
}

const handleStroke = (segment: StrokeSegment): void => {
  session.broadcastStroke(segment)
}

const handleClear = (): void => {
  session.broadcastClear()
}

const startGame = (): void => {
  session.startRound()
}

const handleRestart = (): void => {
  session.restartGame()
}

const pickWord = (word: string): void => {
  session.pickWord(word)
}

const handleNameChange = (): void => {
  const trimmed = playerName.value.trim()
  if (!trimmed) return
  session.updateProfile(trimmed, playerColor.value)
}

const handleColorChange = (color: string): void => {
  playerColor.value = color
  session.updateProfile(playerName.value.trim() || playerName.value, color)
}

const tickInterval = ref<ReturnType<typeof setInterval> | null>(null)
const intermissionTickInterval = ref<ReturnType<typeof setInterval> | null>(null)

watch(intermissionEndsAt, (endsAt) => {
  if (intermissionTickInterval.value) clearInterval(intermissionTickInterval.value)
  if (!endsAt) {
    intermissionLeft.value = 0
    return
  }
  const update = (): void => {
    intermissionLeft.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
  }
  update()
  intermissionTickInterval.value = setInterval(update, 250)
})

watch(
  () => round.value.endsAt,
  (endsAt) => {
    if (tickInterval.value) clearInterval(tickInterval.value)
    if (!endsAt) return
    tickInterval.value = setInterval(() => {
      timeLeft.value = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      if (timeLeft.value !== 0) return
      if (phase.value === 'drawing' && isHost.value) {
        session.endRound()
      } else if (phase.value === 'choosing' && isDrawer.value) {
        const choices = round.value.choices
        if (choices.length > 0) {
          session.pickWord(choices[Math.floor(Math.random() * choices.length)])
        }
      }
    }, 250)
  }
)

onMounted(() => {
  session.init()
})
</script>

<template>
  <main class="pictionary" :class="`pictionary--${phase}`" :style="backgroundStyle">
    <header class="pictionary__header">
      <div class="pictionary__room">
        <span class="pictionary__room-label">Room:</span>
        <code class="pictionary__room-id">{{ roomId.slice(0, 8) }}</code>
        <button class="pictionary__copy-btn" type="button" @click="copyLink">Copy link</button>
      </div>
    </header>

    <section v-if="phase === 'lobby'" class="pictionary__lobby">
      <div class="pictionary__profile">
        <h2 class="pictionary__profile-title">👋 Your name</h2>
        <div class="pictionary__profile-row">
          <label class="pictionary__field">
            Name
            <input
              v-model="playerName"
              type="text"
              maxlength="20"
              class="pictionary__name-input"
              @change="handleNameChange"
              @blur="handleNameChange"
            />
          </label>
          <div class="pictionary__swatches">
            <button
              v-for="color in PLAYER_COLORS"
              :key="color"
              class="pictionary__swatch-btn"
              :class="{ 'pictionary__swatch-btn--active': playerColor === color }"
              :style="{ background: color }"
              type="button"
              :title="`Pick color ${color}`"
              @click="handleColorChange(color)"
            >
              <Check v-if="playerColor === color" class="pictionary__swatch-check" />
            </button>
          </div>
        </div>
      </div>
      <p class="pictionary__hint">
        Share the room link with friends. Game starts when the host clicks Start.
      </p>
      <div class="pictionary__rules">
        <h3 class="pictionary__rules-title">How points work</h3>
        <ul class="pictionary__rules-list">
          <li>
            <strong>{{ POINTS_GUESSER }} pts</strong> to the first player who guesses the word
          </li>
          <li>
            <strong>{{ POINTS_DRAWER }} pts</strong> to the drawer for each correct guess
          </li>
          <li>Hints reveal extra letters during the round (configurable above)</li>
          <li>The player with the most points after all rounds wins</li>
        </ul>
      </div>
      <div v-if="isHost" class="pictionary__host-controls">
        <label class="pictionary__field">
          Difficulty
          <select v-model="difficulty">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label class="pictionary__field">
          Rounds
          <input v-model.number="totalRounds" type="number" min="1" max="20" />
        </label>
        <label class="pictionary__field">
          Round time
          <select v-model.number="roundDuration">
            <option v-for="seconds in ROUND_DURATION_OPTIONS" :key="seconds" :value="seconds">
              {{ seconds }}s
            </option>
          </select>
        </label>
        <label class="pictionary__field">
          Words
          <select v-model.number="wordCount">
            <option v-for="count in WORD_COUNT_OPTIONS" :key="count" :value="count">
              {{ count }}
            </option>
          </select>
        </label>
        <label class="pictionary__field">
          Hints
          <select v-model.number="hintCount">
            <option v-for="count in HINT_COUNT_OPTIONS" :key="count" :value="count">
              {{ count }}
            </option>
          </select>
        </label>
        <button
          class="pictionary__start-btn"
          type="button"
          :disabled="playerList.length < 2"
          @click="startGame"
        >
          Start round {{ round.number + 1 }}
        </button>
      </div>
      <p v-else class="pictionary__hint">Waiting for the host to start the round…</p>
    </section>

    <section v-else-if="phase === 'choosing'" class="pictionary__choosing">
      <p class="pictionary__choosing-title">
        <span v-if="isDrawer">🎨 Pick a word to draw!</span>
        <span v-else
          >✨ {{ playerList.find((p) => p.id === round.drawerId)?.name }} is picking a word…</span
        >
        <span class="pictionary__choosing-timer">⏱ {{ timeLeft }}s</span>
      </p>
      <div v-if="isDrawer" class="pictionary__choices">
        <button
          v-for="(choice, index) in round.choices"
          :key="choice"
          class="pictionary__choice-btn"
          :class="`pictionary__choice-btn--${index % 3}`"
          type="button"
          @click="pickWord(choice)"
        >
          {{ choice }}
        </button>
      </div>
      <div v-else class="pictionary__choices pictionary__choices--placeholder">
        <div v-for="n in 3" :key="n" class="pictionary__choice-btn pictionary__choice-btn--ghost">
          ?
        </div>
      </div>
    </section>

    <section v-else-if="phase === 'drawing'" class="pictionary__play">
      <div class="pictionary__word-banner">
        <span class="pictionary__banner-label">
          {{ isDrawer ? '🖍 Draw this' : '🔍 Guess this' }}
        </span>
        <span
          class="pictionary__banner-word"
          :class="{ 'pictionary__banner-word--masked': !isDrawer }"
        >
          {{ isDrawer ? round.word : maskedWord }}
        </span>
        <span class="pictionary__banner-meta">
          Round {{ round.number }} / {{ totalRounds }} · ⏱ {{ timeLeft }}s
        </span>
      </div>
      <DrawingCanvas
        ref="drawingCanvasReference"
        :interactive="isDrawer"
        :color="strokeColor"
        :size="strokeSize"
        @stroke="handleStroke"
        @clear="handleClear"
      />
      <div v-if="isDrawer" class="pictionary__tools">
        <label class="pictionary__tool">
          <span class="pictionary__tool-label">Color</span>
          <input v-model="strokeColor" type="color" />
        </label>
        <label class="pictionary__tool pictionary__tool--size">
          <span class="pictionary__tool-label">Brush: {{ strokeSize }}px</span>
          <input v-model.number="strokeSize" type="range" min="1" max="32" />
        </label>
      </div>
    </section>

    <section v-else-if="phase === 'intermission'" class="pictionary__intermission">
      <p class="pictionary__intermission-title">
        ⏭ Round {{ Math.min(round.number + 1, totalRounds) }} of {{ totalRounds }} starting…
      </p>
      <div class="pictionary__intermission-timer">{{ intermissionLeft }}</div>
      <p v-if="round.word" class="pictionary__intermission-word">
        The word was <strong>{{ round.word }}</strong>
      </p>
    </section>

    <section v-else class="pictionary__summary">
      <div class="pictionary__fireworks" aria-hidden="true">
        <span v-for="i in 12" :key="i" :class="`pictionary__firework pictionary__firework--${i}`" />
      </div>
      <h2 class="pictionary__summary-title">Game over!</h2>
      <p v-if="topPlayers.length > 1" class="pictionary__summary-winner">
        It's a tie! <strong>{{ winnerLabel }}</strong> share {{ topPlayers[0].score }} points.
      </p>
      <p v-else-if="winnerId" class="pictionary__summary-winner">
        Winner: <strong>{{ winnerLabel }}</strong> with {{ topPlayers[0].score }} points.
      </p>
      <button
        v-if="isHost"
        class="pictionary__start-btn"
        type="button"
        :disabled="playerList.length < 2"
        @click="handleRestart"
      >
        <RotateCcw class="pictionary__btn-icon" />
        Restart game
      </button>
    </section>

    <aside class="pictionary__sidebar">
      <div class="pictionary__players">
        <h3 class="pictionary__sidebar-title">Players</h3>
        <ul class="pictionary__player-list">
          <li
            v-for="player in playerList"
            :key="player.id"
            class="pictionary__player"
            :class="{ 'pictionary__player--drawer': round.drawerId === player.id }"
          >
            <span class="pictionary__player-swatch" :style="{ background: player.color }" />
            <span
              v-if="round.drawerId === player.id"
              class="pictionary__player-icon"
              title="Drawing"
              aria-label="Drawing"
              >✏️</span
            >
            <span class="pictionary__player-name">{{ player.name }}</span>
            <span class="pictionary__player-score">{{ player.score }}</span>
          </li>
        </ul>
      </div>
      <div class="pictionary__chat">
        <h3 class="pictionary__sidebar-title">Chat</h3>
        <Chat
          :messages="messages"
          :local-peer-id="localPeerId"
          :placeholder="isDrawer ? 'Drawer cannot chat' : 'Type a guess…'"
          :disabled="isDrawer && phase === 'drawing'"
          @send="handleChatSend"
        />
      </div>
    </aside>
  </main>
</template>

<style scoped>
.pictionary {
  --pic-yellow: #ffd93d;
  --pic-pink: #ff6bcb;
  --pic-blue: #4ecdc4;
  --pic-orange: #ff8c42;
  --pic-purple: #a06cd5;
  --pic-green: #6bcf7f;

  display: grid;
  grid-template-columns: 1fr 320px;
  grid-template-areas: 'header header' 'main sidebar';
  grid-template-rows: auto 1fr;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  padding-top: calc(var(--nav-height) + var(--spacing-3));
  min-height: 100vh;
  box-sizing: border-box;
  background: #fff7e6;
  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', cursive, system-ui;
}

.pictionary__header {
  grid-area: header;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary__title {
  margin: 0;
  font-size: var(--font-size-xl, 1.5rem);
  font-weight: 800;
  background: linear-gradient(90deg, var(--pic-pink), var(--pic-orange), var(--pic-yellow));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  letter-spacing: 0.04em;
  transform: rotate(-1.5deg);
}

.pictionary__room {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary__room-id {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-secondary);
  border-radius: var(--radius-sm);
}

.pictionary__copy-btn,
.pictionary__start-btn {
  padding: var(--spacing-2) var(--spacing-4, 1rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--pic-yellow);
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
}

.pictionary__copy-btn:hover,
.pictionary__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.pictionary__start-btn {
  background: var(--pic-pink);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary__btn-icon {
  width: 1.1em;
  height: 1.1em;
}

.pictionary__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

.pictionary__lobby,
.pictionary__play,
.pictionary__intermission,
.pictionary__summary {
  grid-area: main;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.pictionary__play {
  justify-content: space-between;
}

.pictionary__hint {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.pictionary__host-controls {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
}

.pictionary__profile {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 #111;
  max-width: 28rem;
  width: 100%;
}

.pictionary__profile-title {
  margin: 0;
  font-size: var(--font-size-md, 1.125rem);
  font-weight: 800;
  color: #111;
}

.pictionary__profile-row {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
  flex-wrap: wrap;
}

.pictionary__field .pictionary__name-input,
.pictionary__field .pictionary__name-input:focus {
  padding: var(--spacing-2) var(--spacing-3);
  border: 3px solid #111;
  border-radius: 999px;
  background: #fff;
  color: #111;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  min-width: 12rem;
  outline: none;
}

.pictionary__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.pictionary__swatch-btn {
  width: 2rem;
  height: 2rem;
  border: 2px solid #111;
  border-radius: 50%;
  cursor: pointer;
  padding: 0;
  box-shadow: 2px 2px 0 #111;
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.pictionary__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.pictionary__swatch-check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}

.pictionary__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: #111;
  font-weight: 700;
}

.pictionary__field select,
.pictionary__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pictionary__word-banner {
  box-sizing: border-box;
  width: 100%;
  max-width: min(600px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-3) var(--spacing-4, 1rem);
  border: 4px dashed #111;
  border-radius: 1.25rem;
  background: linear-gradient(135deg, var(--pic-yellow), var(--pic-orange));
  box-shadow: 5px 5px 0 #111;
  text-align: center;
  z-index: 3;
}

.pictionary__banner-label {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.pictionary__banner-word {
  max-width: 100%;
  font-size: clamp(1.25rem, 4vw, 2.5rem);
  font-weight: 900;
  letter-spacing: 0.1em;
  color: #111;
  text-transform: uppercase;
  text-shadow: 2px 2px 0 #fff;
  word-break: break-word;
  overflow-wrap: anywhere;
  line-height: 1.15;
}

.pictionary__banner-word--masked {
  font-family: var(--font-mono);
  color: #333;
}

.pictionary__banner-meta {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: #111;
  opacity: 0.8;
}

.pictionary__intermission-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #111;
  margin: 0;
}

.pictionary__intermission-timer {
  font-size: 5rem;
  font-weight: 900;
  color: #111;
  background: var(--pic-yellow);
  border: 4px solid #111;
  border-radius: 50%;
  width: 8rem;
  height: 8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 5px 5px 0 #111;
}

.pictionary__intermission-word {
  font-size: 1.25rem;
  color: #111;
  margin: 0;
}

.pictionary__choosing {
  gap: var(--spacing-4, 1.5rem);
}

.pictionary__choosing-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: #111;
  text-align: center;
  margin: 0;
}

.pictionary__choices {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
  justify-content: center;
}

.pictionary__choice-btn {
  min-width: 180px;
  padding: var(--spacing-4, 1.5rem) var(--spacing-4, 1.5rem);
  border: 4px solid #111;
  border-radius: 1.25rem;
  font-size: 1.5rem;
  font-weight: 800;
  color: #111;
  cursor: pointer;
  box-shadow: 5px 5px 0 #111;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition:
    transform 0.1s ease,
    box-shadow 0.1s ease;
}

.pictionary__choice-btn--0 {
  background: var(--pic-pink);
  transform: rotate(-2deg);
}
.pictionary__choice-btn--1 {
  background: var(--pic-blue);
  transform: rotate(1.5deg);
}
.pictionary__choice-btn--2 {
  background: var(--pic-yellow);
  transform: rotate(-1deg);
}

.pictionary__choice-btn:hover {
  transform: translate(-2px, -2px) rotate(0deg);
  box-shadow: 7px 7px 0 #111;
}

.pictionary__choice-btn--ghost {
  background: #fff;
  color: #bbb;
  cursor: default;
  box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.15);
}

.pictionary__tools {
  display: flex;
  gap: var(--spacing-4, 1.5rem);
  align-items: center;
  padding: var(--spacing-2) var(--spacing-3);
  background: #fff;
  border: 3px solid #111;
  border-radius: 999px;
  box-shadow: 3px 3px 0 #111;
  z-index: 2;
}

.pictionary__tool {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
}

.pictionary__tool-label {
  white-space: nowrap;
}

.pictionary__tool input[type='color'] {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid #111;
  border-radius: 50%;
  padding: 0;
  cursor: pointer;
  background: transparent;
}

.pictionary__tool--size input[type='range'] {
  width: 8rem;
  cursor: pointer;
}

.pictionary__sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  min-height: 0;
}

.pictionary__sidebar-title {
  margin: 0 0 var(--spacing-2) 0;
  font-size: var(--font-size-sm);
  color: #111;
  font-weight: 700;
}

.pictionary__room-label {
  color: #111;
  font-weight: 700;
}

.pictionary__players {
  display: flex;
  flex-direction: column;
}

.pictionary__player-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.pictionary__player {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2) var(--spacing-3);
  border: 2px solid #111;
  border-radius: 999px;
  background: #fff;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: #111;
  box-shadow: 2px 2px 0 #111;
}

.pictionary__player--drawer {
  background: var(--pic-yellow);
  transform: rotate(-1deg);
}

.pictionary__player-icon {
  font-size: 1rem;
  line-height: 1;
}

.pictionary__player-swatch {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
}

.pictionary__player-name {
  flex: 1;
}

.pictionary__player-score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.pictionary__chat {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
}

.pictionary__chat :deep(.chat) {
  flex: 1;
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 3px 3px 0 #111;
  padding: var(--spacing-2);
  box-sizing: border-box;
}

.pictionary__chat :deep(.chat__input),
.pictionary__chat :deep(.chat__send-btn),
.pictionary__chat :deep(.chat__zoom-btn) {
  border-radius: 999px;
  border: 2px solid #111;
}

.pictionary__chat :deep(.chat__list) {
  border-radius: 1rem;
  border: 2px solid #111;
  background: #fff;
}

.pictionary__chat :deep(.chat-message) {
  --chat-message-radius: var(--radius-xl);
  --chat-message-radius-adjacent: 4px;
  --chat-message-bg: #d7d8d9;
}

.pictionary__chat :deep(.chat-message--success) {
  --chat-success-bg: var(--pic-yellow);
  --chat-success-color: #111;
  --chat-success-border: #111;
}

.pictionary__chat :deep(.chat-message--system) {
  --chat-system-bg: #fff4c2;
  --chat-system-color: #111;
}

.pictionary__rules {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: var(--spacing-3);
  background: #fff;
  border: 3px solid #111;
  border-radius: 1.25rem;
  box-shadow: 4px 4px 0 #111;
  max-width: 28rem;
  width: 100%;
  color: #111;
}

.pictionary__rules-title {
  margin: 0;
  font-size: var(--font-size-md, 1.125rem);
  font-weight: 800;
}

.pictionary__rules-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

.pictionary__summary-title {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 900;
  color: #111;
  text-align: center;
}

.pictionary__summary-winner {
  font-size: 1.25rem;
  color: #111;
  margin: 0;
  text-align: center;
}

.pictionary__fireworks {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.pictionary__summary {
  position: relative;
  z-index: 1;
}

.pictionary__summary > *:not(.pictionary__fireworks) {
  position: relative;
  z-index: 1;
}

.pictionary__firework {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  box-shadow:
    0 0 0 2px currentColor,
    0 0 12px 2px currentColor;
  opacity: 0;
  animation: pictionary-firework 2.4s infinite;
}

@keyframes pictionary-firework {
  0% {
    transform: scale(0) translate(0, 0);
    opacity: 1;
  }
  60% {
    opacity: 1;
  }
  100% {
    transform: scale(2.5) translate(var(--firework-dx, 0), var(--firework-dy, 0));
    opacity: 0;
  }
}

.pictionary__firework--1 {
  color: var(--pic-pink);
  top: 20%;
  left: 15%;
  animation-delay: 0s;
  --firework-dx: -40px;
  --firework-dy: -30px;
}
.pictionary__firework--2 {
  color: var(--pic-yellow);
  top: 25%;
  left: 80%;
  animation-delay: 0.3s;
  --firework-dx: 50px;
  --firework-dy: -20px;
}
.pictionary__firework--3 {
  color: var(--pic-blue);
  top: 60%;
  left: 10%;
  animation-delay: 0.6s;
  --firework-dx: -30px;
  --firework-dy: 40px;
}
.pictionary__firework--4 {
  color: var(--pic-orange);
  top: 15%;
  left: 50%;
  animation-delay: 0.9s;
  --firework-dx: 0;
  --firework-dy: -50px;
}
.pictionary__firework--5 {
  color: var(--pic-purple);
  top: 70%;
  left: 75%;
  animation-delay: 1.2s;
  --firework-dx: 40px;
  --firework-dy: 30px;
}
.pictionary__firework--6 {
  color: var(--pic-green);
  top: 40%;
  left: 20%;
  animation-delay: 0.15s;
  --firework-dx: -50px;
  --firework-dy: 0;
}
.pictionary__firework--7 {
  color: var(--pic-pink);
  top: 50%;
  left: 90%;
  animation-delay: 0.45s;
  --firework-dx: 60px;
  --firework-dy: 0;
}
.pictionary__firework--8 {
  color: var(--pic-yellow);
  top: 80%;
  left: 40%;
  animation-delay: 0.75s;
  --firework-dx: 0;
  --firework-dy: 50px;
}
.pictionary__firework--9 {
  color: var(--pic-blue);
  top: 30%;
  left: 35%;
  animation-delay: 1.05s;
  --firework-dx: -20px;
  --firework-dy: -40px;
}
.pictionary__firework--10 {
  color: var(--pic-orange);
  top: 65%;
  left: 55%;
  animation-delay: 1.35s;
  --firework-dx: 30px;
  --firework-dy: 30px;
}
.pictionary__firework--11 {
  color: var(--pic-purple);
  top: 10%;
  left: 70%;
  animation-delay: 1.65s;
  --firework-dx: 40px;
  --firework-dy: -50px;
}
.pictionary__firework--12 {
  color: var(--pic-green);
  top: 85%;
  left: 20%;
  animation-delay: 1.95s;
  --firework-dx: -40px;
  --firework-dy: 30px;
}

@media (max-width: 720px) {
  .pictionary {
    grid-template-columns: 1fr;
    grid-template-areas: 'header' 'main' 'sidebar';
    grid-template-rows: auto auto 1fr;
    height: 100dvh;
    min-height: 0;
    padding: 0 var(--spacing-2);
    padding-top: var(--nav-height);
    padding-bottom: var(--spacing-2);
    gap: var(--spacing-2);
    overflow: hidden;
  }

  .pictionary--lobby {
    grid-template-rows: auto auto auto;
    height: auto;
    overflow: auto;
  }

  .pictionary__sidebar {
    flex-direction: column-reverse;
    min-height: 0;
    overflow: hidden;
  }

  .pictionary__chat {
    flex: 1;
    min-height: 0;
    max-height: 240px;
  }

  .pictionary__host-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .pictionary__tools {
    padding: var(--spacing-1) var(--spacing-2);
    gap: var(--spacing-2);
  }

  .pictionary__tool input[type='color'] {
    width: 1.75rem;
    height: 1.75rem;
  }

  .pictionary__tool--size input[type='range'] {
    width: 5rem;
  }

  .pictionary--drawing {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }

  .pictionary--drawing .pictionary__play {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    align-items: center;
    gap: var(--spacing-1);
    min-height: 0;
    overflow: hidden;
  }

  .pictionary__players {
    flex-shrink: 0;
  }
}
</style>
