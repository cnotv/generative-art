<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { GuessRow, LetterStatus } from '@/stores/wordSquares'
import { MAX_ATTEMPTS, KEYBOARD_ROWS } from './constants'

const props = defineProps<{
  word: string
  roundNumber: number
  totalRounds: number
  timeLeft: number
  myGuesses: GuessRow[]
  isSolved: boolean
  isOutOfAttempts: boolean
}>()

const emit = defineEmits<{
  submitGuess: [guess: string]
}>()

const currentInput = ref('')

const wordLength = computed(() => props.word.length)

const rows = computed(
  (): Array<{ letters: Array<{ char: string; status: LetterStatus | null }> }> => {
    return Array.from({ length: MAX_ATTEMPTS }, (_, rowIndex) => {
      const guess = props.myGuesses[rowIndex]
      if (guess) {
        return {
          letters: [...guess.word].map((char, i) => ({ char, status: guess.result[i] }))
        }
      }
      const isCurrentRow = rowIndex === props.myGuesses.length
      if (isCurrentRow && !props.isSolved && !props.isOutOfAttempts) {
        return {
          letters: Array.from({ length: wordLength.value }, (__, i) => ({
            char: currentInput.value[i] ?? '',
            status: null
          }))
        }
      }
      return {
        letters: Array.from({ length: wordLength.value }, () => ({ char: '', status: null }))
      }
    })
  }
)

const letterStatuses = computed((): Record<string, LetterStatus> => {
  const map: Record<string, LetterStatus> = {}
  props.myGuesses.forEach((guess) => {
    guess.result.forEach((status, i) => {
      const letter = guess.word[i]
      if (!letter) return
      const current = map[letter]
      if (!current || status === 'correct' || (status === 'present' && current === 'absent')) {
        map[letter] = status
      }
    })
  })
  return map
})

const canSubmit = computed(
  () => !props.isSolved && !props.isOutOfAttempts && currentInput.value.length === wordLength.value
)

const handleKey = (key: string): void => {
  if (props.isSolved || props.isOutOfAttempts) return
  if (key === 'Enter' || key === 'enter') {
    if (canSubmit.value) {
      emit('submitGuess', currentInput.value)
      currentInput.value = ''
    }
    return
  }
  if (key === 'Backspace' || key === '⌫') {
    currentInput.value = currentInput.value.slice(0, -1)
    return
  }
  if (/^[A-Za-z]$/.test(key) && currentInput.value.length < wordLength.value) {
    currentInput.value += key.toUpperCase()
  }
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.ctrlKey || event.altKey || event.metaKey) return
  handleKey(event.key)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="ws-game">
    <div class="ws-game__banner">
      <span class="ws-game__banner-meta">Round {{ roundNumber }} / {{ totalRounds }}</span>
      <span class="ws-game__banner-word">{{ wordLength }} letters</span>
      <span
        class="ws-game__banner-timer"
        :class="{ 'ws-game__banner-timer--urgent': timeLeft <= 10 }"
      >
        ⏱ {{ timeLeft }}s
      </span>
    </div>

    <div v-if="isSolved" class="ws-game__status ws-game__status--solved">
      Solved in {{ myGuesses.length }} {{ myGuesses.length === 1 ? 'attempt' : 'attempts' }}!
    </div>
    <div v-else-if="isOutOfAttempts" class="ws-game__status ws-game__status--failed">
      The word was <strong>{{ word }}</strong>
    </div>

    <div class="ws-game__grid">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="ws-game__row">
        <div
          v-for="(cell, cellIndex) in row.letters"
          :key="cellIndex"
          class="ws-game__cell"
          :class="
            cell.status ? `ws-game__cell--${cell.status}` : cell.char ? 'ws-game__cell--filled' : ''
          "
        >
          {{ cell.char }}
        </div>
      </div>
    </div>

    <div class="ws-game__keyboard">
      <div v-for="(keyRow, rowIndex) in KEYBOARD_ROWS" :key="rowIndex" class="ws-game__key-row">
        <button
          v-for="key in keyRow"
          :key="key"
          class="ws-game__key"
          :class="[
            key === 'Enter' ? 'ws-game__key--wide' : '',
            key === '⌫' ? 'ws-game__key--wide' : '',
            key.length === 1 ? `ws-game__key--${letterStatuses[key] ?? 'default'}` : ''
          ]"
          type="button"
          @click="handleKey(key)"
        >
          {{ key }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ws-game {
  grid-area: main;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-3);
  min-height: 0;
  overflow: hidden;
}

.ws-game__banner {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-2) var(--spacing-4);
  background: #fff;
  border: 3px solid #111;
  border-radius: 999px;
  box-shadow: 3px 3px 0 #111;
  font-weight: 700;
  color: #111;
}

.ws-game__banner-meta {
  font-size: var(--font-size-sm);
}

.ws-game__banner-word {
  font-size: var(--font-size-sm);
  color: #555;
}

.ws-game__banner-timer {
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.ws-game__banner-timer--urgent {
  color: #d32f2f;
  animation: ws-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes ws-pulse {
  from {
    opacity: 1;
  }
  to {
    opacity: 0.5;
  }
}

.ws-game__status {
  padding: var(--spacing-2) var(--spacing-4);
  border: 3px solid #111;
  border-radius: 999px;
  font-weight: 800;
  font-size: var(--font-size-sm);
}

.ws-game__status--solved {
  background: var(--ws-green);
  color: #fff;
  box-shadow: 3px 3px 0 #111;
}

.ws-game__status--failed {
  background: #f5f5f5;
  color: #111;
  box-shadow: 3px 3px 0 #111;
}

.ws-game__grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.ws-game__row {
  display: flex;
  gap: var(--spacing-1);
}

.ws-game__cell {
  width: 3rem;
  height: 3rem;
  border: 3px solid #ccc;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  font-weight: 900;
  text-transform: uppercase;
  color: #111;
  background: #fff;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.ws-game__cell--filled {
  border-color: #999;
}

.ws-game__cell--correct {
  background: var(--ws-green);
  border-color: var(--ws-green);
  color: #fff;
}

.ws-game__cell--present {
  background: var(--ws-yellow);
  border-color: var(--ws-yellow);
  color: #111;
}

.ws-game__cell--absent {
  background: #aaa;
  border-color: #aaa;
  color: #fff;
}

.ws-game__keyboard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-1);
}

.ws-game__key-row {
  display: flex;
  gap: var(--spacing-1);
}

.ws-game__key {
  min-width: 2.25rem;
  height: 3.5rem;
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #d3d6da;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 var(--spacing-1);
  transition:
    background 0.1s ease,
    transform 0.05s ease;
  box-shadow: 2px 2px 0 #111;
}

.ws-game__key:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 #111;
}

.ws-game__key--wide {
  min-width: 4rem;
  font-size: var(--font-size-xs);
}

.ws-game__key--correct {
  background: var(--ws-green);
  color: #fff;
  border-color: var(--ws-green);
}

.ws-game__key--present {
  background: var(--ws-yellow);
  color: #111;
  border-color: var(--ws-yellow);
}

.ws-game__key--absent {
  background: #787c7e;
  color: #fff;
  border-color: #787c7e;
}

@media (max-width: 720px) {
  .ws-game__cell {
    width: 2.25rem;
    height: 2.25rem;
    font-size: 1rem;
  }

  .ws-game__key {
    min-width: 1.9rem;
    height: 3rem;
    font-size: 0.7rem;
  }

  .ws-game__key--wide {
    min-width: 3rem;
  }
}
</style>
