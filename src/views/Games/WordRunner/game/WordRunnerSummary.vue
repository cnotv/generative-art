<script setup lang="ts">
import { computed, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import { formatRunTime } from './bestTimes'
import { sentenceText } from '../sequence/levelText'
import type { CefrDescription, Level, RunReport } from '../types'

const props = defineProps<{
  level: Level
  report: RunReport
  description: CefrDescription
  bestSeconds: number | null
  isNewBest: boolean
  hasNextLevel: boolean
}>()

const emit = defineEmits<{
  next: []
  restart: []
  pick: []
}>()

const nextReference = ref<ComponentPublicInstance | null>(null)
const againReference = ref<ComponentPublicInstance | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

const won = computed(() => props.report.race.won)
const raceLine = computed(() => {
  const { race } = props.report
  return race.won
    ? `${Math.round(race.metresAhead)} m ahead of the bot`
    : `${race.secondsBehind.toFixed(1)} s behind the bot`
})
const verdict = computed(() =>
  won.value
    ? `${props.level.cefr} cleared. ${props.description.canDo}`
    : `Win the race to clear ${props.level.cefr} and open the next level.`
)
const sentences = computed(() =>
  props.level.sentences.map((sentence) => ({
    text: sentenceText(sentence.words),
    translation: sentence.translation
  }))
)
const showNext = computed(() => won.value && props.hasNextLevel)

onMounted(() => {
  const primary = nextReference.value ?? againReference.value
  ;(primary?.$el as HTMLElement | undefined)?.focus()
})
</script>

<template>
  <div class="word-runner-summary">
    <div ref="dialogReference" class="word-runner-summary__dialog">
      <h2
        class="word-runner-summary__title lui-slide-in"
        :class="{ 'word-runner-summary__title--won': won }"
      >
        {{ won ? 'You got there first' : 'The bot got there first' }}
      </h2>
      <p class="word-runner-summary__line lui-slide-in">
        {{ level.cefr }} · {{ level.title }} · {{ raceLine }}
      </p>
      <p class="word-runner-summary__time lui-slide-in">
        <span :class="{ 'word-runner-summary__time--best': isNewBest }">{{
          formatRunTime(report.seconds)
        }}</span>
        <span v-if="isNewBest" class="word-runner-summary__best">New best</span>
        <span v-else-if="bestSeconds !== null" class="word-runner-summary__best"
          >Best {{ formatRunTime(bestSeconds) }}</span
        >
        <span class="word-runner-summary__best"
          >{{ report.correctCount }} / {{ report.wordCount }} words right</span
        >
      </p>
      <p class="word-runner-summary__line lui-slide-in lui-slide-in--2">{{ verdict }}</p>
      <p class="word-runner-summary__tip lui-slide-in lui-slide-in--2">{{ report.tip }}</p>
      <div
        v-if="report.missed.length > 0 || !won"
        class="word-runner-summary__details lui-slide-in lui-slide-in--2"
      >
        <section v-if="report.missed.length > 0" class="word-runner-summary__section">
          <h3 class="word-runner-summary__heading">Words to go over</h3>
          <ol class="word-runner-summary__list">
            <li v-for="word in report.missed" :key="word.position" class="word-runner-summary__row">
              <span class="word-runner-summary__word--right">{{ word.text }}</span>
              <span class="word-runner-summary__gloss">{{ word.gloss }}</span>
              <span class="word-runner-summary__word--wrong">not {{ word.chosen }}</span>
            </li>
          </ol>
        </section>
        <section v-if="!won" class="word-runner-summary__section">
          <h3 class="word-runner-summary__heading">The text</h3>
          <ol class="word-runner-summary__list">
            <li
              v-for="(sentence, index) in sentences"
              :key="index"
              class="word-runner-summary__sentence"
            >
              <span>{{ sentence.text }}</span>
              <span class="word-runner-summary__gloss">{{ sentence.translation }}</span>
            </li>
          </ol>
        </section>
      </div>
      <div class="word-runner-summary__actions lui-slide-in lui-slide-in--3" data-lui-row>
        <LobbyUIButton
          v-if="showNext"
          ref="nextReference"
          variant="cta"
          size="sm"
          title="Race the next level"
          @click="emit('next')"
        >
          Next level
        </LobbyUIButton>
        <LobbyUIButton
          ref="againReference"
          :variant="showNext ? 'ghost' : 'cta'"
          size="sm"
          title="Race this level again"
          @click="emit('restart')"
        >
          Race again
        </LobbyUIButton>
        <LobbyUIButton size="sm" variant="ghost" title="Choose a level" @click="emit('pick')">
          Levels
        </LobbyUIButton>
      </div>
    </div>
    <LobbyUIFocusHint :hint="focusedHint" :visible="inputSource === 'gamepad'" />
  </div>
</template>

<style scoped>
.word-runner-summary {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-4);
  pointer-events: none;
}

.word-runner-summary__dialog {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
  max-height: 100%;
  text-align: center;
  pointer-events: all;
}

.word-runner-summary__title,
.word-runner-summary__line,
.word-runner-summary__tip,
.word-runner-summary__heading,
.word-runner-summary__time,
.word-runner-summary__row,
.word-runner-summary__sentence {
  margin: 0;
  font-family: var(--lui-font);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.word-runner-summary__title {
  font-size: var(--lui-text-medium);
  line-height: 1;
  text-transform: uppercase;
}

.word-runner-summary__title--won {
  color: var(--lui-focus-color);
}

.word-runner-summary__line {
  max-width: 36rem;
  font-size: var(--lui-text-small);
}

.word-runner-summary__tip {
  max-width: 36rem;
  font-size: var(--lui-text-small);
  color: var(--lui-focus-color);
}

/* The one part allowed to scroll, so the title and the actions always stay on screen. */
.word-runner-summary__details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--spacing-4);
  width: min(100%, 52rem);
  min-height: 0;
  padding: var(--spacing-2);
  overflow-y: auto;
}

.word-runner-summary__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  align-items: center;
}

.word-runner-summary__heading {
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
}

.word-runner-summary__sentence {
  display: flex;
  flex-direction: column;
  font-size: var(--lui-text-tiny);
}

.word-runner-summary__time {
  display: flex;
  gap: var(--spacing-3);
  align-items: baseline;
  font-size: var(--lui-text-medium);
  font-variant-numeric: tabular-nums;
}

.word-runner-summary__time--best {
  color: var(--lui-focus-color);
}

.word-runner-summary__best {
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
}

.word-runner-summary__list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  padding: 0;
  margin: 0;
  list-style: none;
}

.word-runner-summary__row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--spacing-3);
  align-items: baseline;
  font-size: var(--lui-text-small);
}

.word-runner-summary__word--right {
  color: var(--lui-answer-right);
}

.word-runner-summary__word--wrong {
  color: var(--lui-answer-wrong);
}

.word-runner-summary__gloss {
  font-size: var(--lui-text-tiny);
  text-align: left;
}

.word-runner-summary__actions {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}
</style>
