<script setup lang="ts">
import { Check, Plus, Minus } from 'lucide-vue-next'
import type { DictionaryDifficulty } from '@webgamekit/dictionary'
import type { PictionaryPlayer, PictionaryRound } from '@/stores/pictionary'
import {
  PLAYER_COLORS,
  ROUND_DURATION_OPTIONS,
  WORD_COUNT_OPTIONS,
  HINT_COUNT_OPTIONS,
  POINTS_BASE,
  POINTS_FIRST_BONUS,
  POINTS_DRAWER_PER_GUESS
} from './constants'

defineProps<{
  playerName: string
  playerColor: string
  isHost: boolean
  playerList: PictionaryPlayer[]
  round: PictionaryRound
  difficulty: DictionaryDifficulty
  totalRounds: number
  roundDuration: number
  wordCount: number
  hintCount: number
}>()

const emit = defineEmits<{
  'update:playerName': [value: string]
  'update:playerColor': [value: string]
  'update:difficulty': [value: DictionaryDifficulty]
  'update:totalRounds': [value: number]
  'update:roundDuration': [value: number]
  'update:wordCount': [value: number]
  'update:hintCount': [value: number]
  nameChange: []
  startGame: []
}>()

const handleNameInput = (event: Event): void => {
  emit('update:playerName', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="pictionary-lobby">
    <div class="pictionary-lobby__profile">
      <h2 class="pictionary-lobby__profile-title">👋 Your name</h2>
      <div class="pictionary-lobby__profile-row">
        <label class="pictionary-lobby__field">
          Name
          <input
            :value="playerName"
            type="text"
            maxlength="20"
            class="pictionary-lobby__name-input"
            @input="handleNameInput"
            @change="emit('nameChange')"
            @blur="emit('nameChange')"
          />
        </label>
        <div class="pictionary-lobby__swatches">
          <button
            v-for="color in PLAYER_COLORS"
            :key="color"
            class="pictionary-lobby__swatch-btn"
            :class="{ 'pictionary-lobby__swatch-btn--active': playerColor === color }"
            :style="{ background: color }"
            type="button"
            :title="`Pick color ${color}`"
            @click="emit('update:playerColor', color)"
          >
            <Check v-if="playerColor === color" class="pictionary-lobby__swatch-check" />
          </button>
        </div>
      </div>
    </div>
    <p class="pictionary-lobby__hint">
      Share the room link with friends. Game starts when the host clicks Start.
    </p>
    <details class="pictionary-lobby__rules">
      <summary class="pictionary-lobby__rules-title">
        <Plus class="pictionary-lobby__rules-icon pictionary-lobby__rules-icon--closed" />
        <Minus class="pictionary-lobby__rules-icon pictionary-lobby__rules-icon--open" />
        How points work
      </summary>
      <ul class="pictionary-lobby__rules-list">
        <li>
          Guessers earn up to <strong>{{ POINTS_BASE }} pts</strong> based on speed — faster guesses
          score more
        </li>
        <li>
          First correct guess gets a <strong>+{{ POINTS_FIRST_BONUS }} pts</strong> bonus
        </li>
        <li>
          Drawer earns up to <strong>{{ POINTS_DRAWER_PER_GUESS }} pts</strong> per correct guess,
          scaled by time remaining
        </li>
        <li>Everyone can guess — the round continues until time runs out or all players guess</li>
        <li>Hints reveal extra letters during the round (configurable above)</li>
      </ul>
    </details>
    <div v-if="isHost" class="pictionary-lobby__host-controls">
      <label class="pictionary-lobby__field">
        Difficulty
        <select
          :value="difficulty"
          @change="
            emit(
              'update:difficulty',
              ($event.target as HTMLSelectElement).value as DictionaryDifficulty
            )
          "
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label class="pictionary-lobby__field">
        Rounds
        <input
          :value="totalRounds"
          type="number"
          min="1"
          max="20"
          @input="emit('update:totalRounds', Number(($event.target as HTMLInputElement).value))"
        />
      </label>
      <label class="pictionary-lobby__field">
        Round time
        <select
          :value="roundDuration"
          @change="emit('update:roundDuration', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="seconds in ROUND_DURATION_OPTIONS" :key="seconds" :value="seconds">
            {{ seconds }}s
          </option>
        </select>
      </label>
      <label class="pictionary-lobby__field">
        Words
        <select
          :value="wordCount"
          @change="emit('update:wordCount', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="count in WORD_COUNT_OPTIONS" :key="count" :value="count">
            {{ count }}
          </option>
        </select>
      </label>
      <label class="pictionary-lobby__field">
        Hints
        <select
          :value="hintCount"
          @change="emit('update:hintCount', Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="count in HINT_COUNT_OPTIONS" :key="count" :value="count">
            {{ count }}
          </option>
        </select>
      </label>
      <button
        class="pictionary-lobby__start-btn"
        type="button"
        :disabled="playerList.length < 2"
        @click="emit('startGame')"
      >
        Start round {{ round.number + 1 }}
      </button>
    </div>
    <p v-else class="pictionary-lobby__hint">Waiting for the host to start the round…</p>
  </section>
</template>

<style scoped>
.pictionary-lobby {
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

.pictionary-lobby__profile {
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

.pictionary-lobby__profile-title {
  margin: 0;
  font-size: var(--font-size-md, 1.125rem);
  font-weight: 800;
  color: #111;
}

.pictionary-lobby__profile-row {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
  flex-wrap: wrap;
}

.pictionary-lobby__field .pictionary-lobby__name-input,
.pictionary-lobby__field .pictionary-lobby__name-input:focus {
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

.pictionary-lobby__swatches {
  display: flex;
  gap: var(--spacing-1);
  flex-wrap: wrap;
}

.pictionary-lobby__swatch-btn {
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

.pictionary-lobby__swatch-btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 #111;
}

.pictionary-lobby__swatch-check {
  width: 1rem;
  height: 1rem;
  color: #fff;
  stroke-width: 4;
}

.pictionary-lobby__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-xs);
  color: #111;
  font-weight: 700;
}

.pictionary-lobby__field select,
.pictionary-lobby__field input {
  padding: var(--spacing-1) var(--spacing-2);
  border: 2px solid #111;
  border-radius: var(--radius-sm);
  background: #fff;
  color: #111;
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.pictionary-lobby__hint {
  color: var(--color-muted-foreground);
  font-size: var(--font-size-sm);
}

.pictionary-lobby__host-controls {
  display: flex;
  gap: var(--spacing-3);
  align-items: flex-end;
}

.pictionary-lobby__start-btn {
  padding: var(--spacing-2) var(--spacing-5, 1.5rem);
  border: 3px solid #111;
  border-radius: 999px;
  background: var(--pic-pink);
  color: #fff;
  font-size: var(--font-size-md, 1rem);
  font-weight: 700;
  cursor: pointer;
  box-shadow: 3px 3px 0 #111;
  transition: transform 0.1s ease;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
}

.pictionary-lobby__start-btn:hover:not(:disabled) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 #111;
}

.pictionary-lobby__start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: 2px 2px 0 #111;
}

.pictionary-lobby__rules {
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

.pictionary-lobby__rules-title {
  margin: 0;
  font-size: var(--font-size-md, 1.125rem);
  font-weight: 800;
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
}

.pictionary-lobby__rules-title::-webkit-details-marker {
  display: none;
}

.pictionary-lobby__rules-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.pictionary-lobby__rules-icon--open {
  display: none;
}

.pictionary-lobby__rules[open] .pictionary-lobby__rules-icon--closed {
  display: none;
}

.pictionary-lobby__rules[open] .pictionary-lobby__rules-icon--open {
  display: block;
}

.pictionary-lobby__rules-list {
  margin: 0;
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  font-size: var(--font-size-sm);
  line-height: 1.4;
}

@media (max-width: 720px) {
  .pictionary-lobby {
    padding-left: var(--spacing-3);
    padding-right: var(--spacing-3);
  }

  .pictionary-lobby__host-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
