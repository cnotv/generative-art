<script setup lang="ts">
import { computed, onMounted, ref, type ComponentPublicInstance } from 'vue'
import { LobbyUIButton, LobbyUIFocusHint } from '@/components/LobbyUI'
import { useDialogFocusTrap } from '@/composables/useDialogFocusTrap'
import { formatRunTime } from './bestTimes'
import { capitalise } from '../sequence/levelText'
import type { Level, RunReport } from '../types'

const props = defineProps<{
  level: Level
  report: RunReport
  bestSeconds: number | null
  isNewBest: boolean
  hasNextLevel: boolean
  canRestart: boolean
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
const unlockNote = computed(() => {
  if (!won.value) return 'Win the race to unlock the next level'
  return props.hasNextLevel ? 'Next level unlocked' : 'Every level complete'
})
const title = computed(() =>
  won.value ? 'Level complete' : `${capitalise(props.report.race.rivalName)} got there first`
)
const raceLine = computed(() => {
  const { race } = props.report
  return race.won
    ? `${Math.round(race.metresAhead)} m ahead of ${race.rivalName}`
    : `${race.secondsBehind.toFixed(1)} s behind ${race.rivalName}`
})

/** The text as the player picked it, sentence by sentence, each with its English. */
const pickedSentences = computed(() =>
  props.level.sentences.map((sentence, sentenceIndex) => {
    const offset = props.level.sentences
      .slice(0, sentenceIndex)
      .reduce((total, earlier) => total + earlier.words.length, 0)
    return {
      translation: sentence.translation,
      words: sentence.words.map((word, wordIndex) => {
        const pick = props.report.picks.find(
          (candidate) => candidate.position === offset + wordIndex
        )
        return {
          key: offset + wordIndex,
          opening: word.opening ?? '',
          punctuation: word.punctuation ?? '',
          chosen: pick?.chosen ?? word.text,
          text: word.text,
          correct: pick?.correct ?? true
        }
      })
    }
  })
)
const showNext = computed(() => props.canRestart && won.value && props.hasNextLevel)

onMounted(() => {
  const primary = nextReference.value ?? againReference.value
  ;(primary?.$el as HTMLElement | undefined)?.focus()
})
</script>

<template>
  <div class="word-runner-summary">
    <div ref="dialogReference" class="word-runner-summary__dialog">
      <header class="word-runner-summary__header lui-slide-in">
        <p
          class="word-runner-summary__unlock"
          :class="{ 'word-runner-summary__unlock--open': won }"
        >
          {{ unlockNote }}
        </p>
        <h2 class="word-runner-summary__title" :class="{ 'word-runner-summary__title--won': won }">
          {{ title }}
        </h2>
        <p class="word-runner-summary__line">
          <span>{{ level.cefr }} · {{ level.title }}</span>
          <span :class="{ 'word-runner-summary__best': isNewBest }">{{
            formatRunTime(report.seconds)
          }}</span>
          <span v-if="isNewBest" class="word-runner-summary__best">New best</span>
          <span v-else-if="bestSeconds !== null">Best {{ formatRunTime(bestSeconds) }}</span>
          <span>{{ report.correctCount }} / {{ report.wordCount }} words</span>
          <span>{{ raceLine }}</span>
        </p>
      </header>

      <section
        class="word-runner-summary__picks lui-slide-in lui-slide-in--2"
        aria-label="Your words"
      >
        <div
          v-for="(sentence, index) in pickedSentences"
          :key="index"
          class="word-runner-summary__sentence"
        >
          <p class="word-runner-summary__words">
            <span v-for="word in sentence.words" :key="word.key" class="word-runner-summary__word">
              {{ word.opening }}<template v-if="word.correct">{{ word.chosen }}</template
              ><template v-else
                ><span class="word-runner-summary__word--wrong">{{ word.chosen }}</span
                ><span class="word-runner-summary__word--right">{{ word.text }}</span></template
              >{{ word.punctuation }}
            </span>
          </p>
          <p class="word-runner-summary__english">{{ sentence.translation }}</p>
        </div>
      </section>

      <p v-if="!canRestart" class="word-runner-summary__waiting lui-slide-in lui-slide-in--3">
        Waiting for host…
      </p>
      <div v-else class="word-runner-summary__actions lui-slide-in lui-slide-in--3" data-lui-row>
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
  gap: var(--spacing-6);
  align-items: center;
  width: min(100%, 52rem);
  max-height: 100%;
  text-align: center;
  pointer-events: all;
}

.word-runner-summary__header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.word-runner-summary__unlock,
.word-runner-summary__title,
.word-runner-summary__line,
.word-runner-summary__words,
.word-runner-summary__english,
.word-runner-summary__waiting {
  margin: 0;
  font-family: var(--lui-font);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.word-runner-summary__unlock {
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.word-runner-summary__unlock--open,
.word-runner-summary__title--won,
.word-runner-summary__best {
  color: var(--lui-focus-color);
}

.word-runner-summary__title {
  font-size: var(--lui-text-medium);
  line-height: 1;
  text-transform: uppercase;
}

.word-runner-summary__line {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1) var(--spacing-4);
  justify-content: center;
  font-size: var(--lui-text-small);
  font-variant-numeric: tabular-nums;
}

/* The one part allowed to scroll, so the title and the actions always stay on screen. */
.word-runner-summary__picks {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
  min-height: 0;
  padding: var(--spacing-2);
  overflow-y: auto;
}

.word-runner-summary__sentence {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  align-items: center;
}

.word-runner-summary__words {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-1) var(--spacing-2);
  justify-content: center;
  font-size: var(--lui-text-small);
}

.word-runner-summary__word--wrong {
  color: var(--lui-answer-wrong);
  text-decoration: line-through;
}

.word-runner-summary__word--right {
  margin-left: var(--spacing-1);
  color: var(--lui-answer-right);
}

.word-runner-summary__english {
  font-size: var(--lui-text-tiny);
}

.word-runner-summary__waiting {
  font-size: var(--lui-text-small);
}

.word-runner-summary__actions {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
}
</style>
