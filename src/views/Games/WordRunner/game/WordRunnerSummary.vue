<script setup lang="ts">
import { computed, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import { formatRunTime } from './bestTimes'
import type { Phrase, WordSummary } from '../types'

const props = defineProps<{
  phrase: Phrase
  summary: WordSummary[]
  runSeconds: number
  bestSeconds: number | null
  isNewBest: boolean
}>()

const emit = defineEmits<{
  restart: []
  pick: []
}>()

const runAgainReference = ref<ComponentPublicInstance | null>(null)
const dialogReference = ref<HTMLElement | null>(null)
const { focusedHint, inputSource } = useDialogFocusTrap(dialogReference)

const rows = computed(() =>
  props.summary.map((wordSummary) => ({
    ...wordSummary,
    text: props.phrase.words[wordSummary.position].text,
    gloss: props.phrase.words[wordSummary.position].gloss,
    isPerfect: wordSummary.attempts > 0 && wordSummary.correct === wordSummary.attempts
  }))
)
const isFlawless = computed(() => rows.value.every((row) => row.isPerfect))

onMounted(() => {
  ;(runAgainReference.value?.$el as HTMLElement | undefined)?.focus()
})
</script>

<template>
  <div class="word-runner-summary">
    <div ref="dialogReference" class="word-runner-summary__dialog">
      <h2
        class="word-runner-summary__title lui-slide-in"
        :class="{ 'word-runner-summary__title--flawless': isFlawless }"
      >
        {{ isFlawless ? 'Not one wrong lane' : 'Phrase run' }}
      </h2>
      <p class="word-runner-summary__translation lui-slide-in">{{ phrase.translation }}</p>
      <p class="word-runner-summary__time lui-slide-in">
        <span :class="{ 'word-runner-summary__time--best': isNewBest }">{{
          formatRunTime(runSeconds)
        }}</span>
        <span v-if="isNewBest" class="word-runner-summary__best">New best</span>
        <span v-else-if="bestSeconds !== null" class="word-runner-summary__best"
          >Best {{ formatRunTime(bestSeconds) }}</span
        >
      </p>
      <ol class="word-runner-summary__list lui-slide-in lui-slide-in--2">
        <li v-for="row in rows" :key="row.position" class="word-runner-summary__row">
          <span
            class="word-runner-summary__word"
            :class="
              row.isPerfect
                ? 'word-runner-summary__word--right'
                : 'word-runner-summary__word--wrong'
            "
            >{{ row.text }}</span
          >
          <span class="word-runner-summary__gloss">{{ row.gloss }}</span>
          <span class="word-runner-summary__score">{{ row.correct }}/{{ row.attempts }}</span>
        </li>
      </ol>
      <div class="word-runner-summary__actions lui-slide-in lui-slide-in--3" data-lui-row>
        <LobbyUIButton
          ref="runAgainReference"
          variant="cta"
          size="sm"
          title="Run the same phrase again"
          @click="emit('restart')"
        >
          Run again
        </LobbyUIButton>
        <LobbyUIButton
          size="sm"
          variant="ghost"
          title="Choose a different phrase"
          @click="emit('pick')"
        >
          Another phrase
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
  gap: var(--spacing-3);
  align-items: center;
  text-align: center;
  pointer-events: all;
}

.word-runner-summary__title,
.word-runner-summary__translation,
.word-runner-summary__time,
.word-runner-summary__row {
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

.word-runner-summary__title--flawless {
  color: var(--lui-focus-color);
}

.word-runner-summary__translation {
  font-size: var(--lui-text-small);
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

.word-runner-summary__word {
  text-align: right;
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

.word-runner-summary__score {
  font-variant-numeric: tabular-nums;
}

.word-runner-summary__actions {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}
</style>
