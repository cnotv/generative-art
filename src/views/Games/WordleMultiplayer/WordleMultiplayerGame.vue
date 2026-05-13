<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { GuessRow, LetterStatus } from '@/stores/wordleMultiplayer'
import { KEYBOARD_ROWS } from './constants'

const props = defineProps<{
  word: string
  maxAttempts: number
  myGuesses: GuessRow[]
  solvedPlayers: Record<string, number>
  localPeerId: string
  roundNumber: number
  totalRounds: number
  timeLeft: number | null
}>()

const emit = defineEmits<{
  submitGuess: [guess: string]
  surrender: []
}>()

const currentGuess = ref('')

const isSolved = computed(() =>
  props.myGuesses.some((row) => row.result.every((s) => s === 'correct'))
)
const isOutOfAttempts = computed(() => props.myGuesses.length >= props.maxAttempts)
const isDone = computed(() => isSolved.value || isOutOfAttempts.value)

const wordLength = computed(() => props.word.length || 5)

const rows = computed(() => {
  const submitted = props.myGuesses.map((row) => ({ letters: [...row.word], result: row.result }))
  const currentRow = isDone.value
    ? []
    : [{ letters: [...currentGuess.value.padEnd(wordLength.value)], result: null }]
  const emptyCount = Math.max(0, props.maxAttempts - submitted.length - currentRow.length)
  const emptyRows = Array.from({ length: emptyCount }, () => ({
    letters: Array(wordLength.value).fill(''),
    result: null
  }))
  return [...submitted, ...currentRow, ...emptyRows]
})

const letterStatuses = computed(() => {
  const STATUS_PRIORITY: Record<LetterStatus, number> = { correct: 2, present: 1, absent: 0 }
  return props.myGuesses.reduce<Record<string, LetterStatus>>((accumulator, row) => {
    ;[...row.word].forEach((letter, i) => {
      const status = row.result[i]
      const current = accumulator[letter]
      if (!current || STATUS_PRIORITY[status] > STATUS_PRIORITY[current]) {
        accumulator[letter] = status
      }
    })
    return accumulator
  }, {})
})

const tileClass = (status: LetterStatus | null, rowIndex: number, colIndex: number): string => {
  const isCurrentRow = rowIndex === props.myGuesses.length && !isDone.value
  if (isCurrentRow && colIndex < currentGuess.value.length) return 'wl-game__tile--active'
  if (status === 'correct') return 'wl-game__tile--correct'
  if (status === 'present') return 'wl-game__tile--present'
  if (status === 'absent') return 'wl-game__tile--absent'
  return ''
}

const keyClass = (key: string): string => {
  const status = letterStatuses.value[key]
  if (status === 'correct') return 'wl-game__key--correct'
  if (status === 'present') return 'wl-game__key--present'
  if (status === 'absent') return 'wl-game__key--absent'
  return ''
}

const handleKeyPress = (key: string): void => {
  if (isDone.value) return
  if (key === 'Enter') {
    if (currentGuess.value.length === wordLength.value) {
      emit('submitGuess', currentGuess.value)
      currentGuess.value = ''
    }
    return
  }
  if (key === '⌫' || key === 'Backspace') {
    currentGuess.value = currentGuess.value.slice(0, -1)
    return
  }
  if (/^[A-Za-z]$/.test(key) && currentGuess.value.length < wordLength.value) {
    currentGuess.value += key.toUpperCase()
  }
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.ctrlKey || event.altKey || event.metaKey) return
  handleKeyPress(event.key === 'Backspace' ? '⌫' : event.key)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="wl-game">
    <div class="wl-game__banner">
      <span class="wl-game__banner-meta">Round {{ roundNumber }} / {{ totalRounds }}</span>
      <span class="wl-game__banner-attempts">
        {{ myGuesses.length }} / {{ maxAttempts }} guesses
      </span>
      <span
        v-if="timeLeft !== null"
        class="wl-game__banner-timer"
        :class="{ 'wl-game__banner-timer--urgent': timeLeft <= 10 }"
      >
        ⏱ {{ timeLeft }}s
      </span>
    </div>

    <div class="wl-game__grid">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="wl-game__row">
        <div
          v-for="(letter, colIndex) in row.letters"
          :key="colIndex"
          class="wl-game__tile"
          :class="tileClass(row.result?.[colIndex] ?? null, rowIndex, colIndex)"
        >
          {{ letter.trim() }}
        </div>
      </div>
    </div>

    <div v-if="isSolved" class="wl-game__status wl-game__status--solved">You solved it!</div>
    <div v-else-if="isOutOfAttempts" class="wl-game__status wl-game__status--failed">
      Out of attempts
    </div>
    <div v-if="isDone && timeLeft === null" class="wl-game__status wl-game__status--waiting">
      Waiting for other players...
    </div>

    <div class="wl-game__keyboard">
      <div v-for="(row, rowIndex) in KEYBOARD_ROWS" :key="rowIndex" class="wl-game__key-row">
        <button
          v-for="key in row"
          :key="key"
          class="wl-game__key"
          :class="[
            keyClass(key),
            key.length > 1 ? 'wl-game__key--wide' : '',
            key === 'Enter' ? 'wl-game__key--enter' : '',
            key === '⌫' ? 'wl-game__key--delete' : ''
          ]"
          type="button"
          :disabled="isDone"
          @click="handleKeyPress(key)"
        >
          {{ key }}
        </button>
      </div>
      <button class="wl-game__surrender" type="button" @click="emit('surrender')">Surrender</button>
    </div>
  </section>
</template>

<style scoped>
.wl-game {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  min-height: 0;
  overflow: auto;
}

.wl-game__banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-4);
  background: var(--game-surface-subtle);
  border: 3px solid var(--game-border);
  border-radius: 999px;
  box-shadow: 3px 3px 0 var(--game-border);
  font-weight: 700;
  color: var(--game-ink);
}

.wl-game__banner-meta,
.wl-game__banner-attempts {
  font-size: var(--font-size-sm);
}

.wl-game__banner-timer {
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.wl-game__banner-timer--urgent {
  color: #d32f2f;
  animation: wl-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes wl-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

.wl-game__grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.wl-game__row {
  display: flex;
  gap: var(--spacing-1);
}

.wl-game__tile {
  width: 3rem;
  height: 3rem;
  border: 3px solid var(--game-border-secondary);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 900;
  color: var(--game-ink);
  background: var(--game-surface-subtle);
  text-transform: uppercase;
  user-select: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.wl-game__tile--active {
  border-color: var(--game-border);
}

.wl-game__tile--correct {
  background: var(--wl-green);
  border-color: var(--wl-green);
  color: #fff;
}

.wl-game__tile--present {
  background: var(--wl-yellow);
  border-color: var(--wl-yellow);
  color: var(--game-ink);
}

.wl-game__tile--absent {
  background: var(--game-ink-muted);
  border-color: var(--game-ink-muted);
  color: #fff;
}

.wl-game__status {
  font-size: var(--font-size-sm);
  font-weight: 700;
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: 999px;
  border: 2px solid var(--game-border);
}

.wl-game__status--solved {
  background: var(--wl-green);
  color: #fff;
}

.wl-game__status--failed {
  background: var(--game-msg-error-bg);
  color: #d32f2f;
}

.wl-game__status--waiting {
  background: var(--game-surface-subtle);
  color: var(--game-ink-medium);
}

.wl-game__keyboard {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  align-items: center;
}

.wl-game__key-row {
  display: flex;
  gap: var(--spacing-1);
}

.wl-game__key {
  min-width: 2.25rem;
  height: 3.5rem;
  border: 2px solid var(--game-border);
  border-radius: var(--radius-sm);
  background: var(--game-surface-subtle);
  color: var(--game-ink);
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 2px 2px 0 var(--game-border);
  transition: transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--spacing-1);
  font-family: inherit;
}

.wl-game__key--wide {
  min-width: 4rem;
  font-size: var(--font-size-xs);
}

.wl-game__key:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--game-border);
}

.wl-game__key:active:not(:disabled) {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--game-border);
}

.wl-game__key:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wl-game__key--correct {
  background: var(--wl-green);
  border-color: var(--wl-green);
  color: #fff;
}

.wl-game__key--present {
  background: var(--wl-yellow);
  border-color: var(--wl-yellow);
  color: var(--game-ink);
}

.wl-game__key--absent {
  background: var(--game-ink-muted);
  border-color: var(--game-ink-muted);
  color: #fff;
}

.wl-game__key--enter {
  background: var(--wl-green);
  border-color: var(--wl-green);
  color: #fff;
}

.wl-game__key--delete {
  background: #d32f2f;
  border-color: #d32f2f;
  color: #fff;
}

.wl-game__surrender {
  margin-top: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-3);
  border: 2px solid var(--game-ink-muted);
  border-radius: 999px;
  background: var(--game-surface-subtle);
  color: var(--game-ink-muted);
  font-size: var(--font-size-xs);
  font-weight: 700;
  cursor: pointer;
  transition:
    color 0.1s ease,
    border-color 0.1s ease;
}

.wl-game__surrender:hover {
  color: #d32f2f;
  border-color: #d32f2f;
}

@media (max-width: 720px) {
  .wl-game__tile {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }

  .wl-game__key {
    min-width: 1.875rem;
    height: 3rem;
    font-size: var(--font-size-xs);
  }

  .wl-game__key--wide {
    min-width: 3.25rem;
  }
}
</style>
