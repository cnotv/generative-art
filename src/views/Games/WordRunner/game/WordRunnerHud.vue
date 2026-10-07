<script setup lang="ts">
import { computed } from 'vue'
import { LobbyUIKeyPill } from '@/components/LobbyUI'
import { formatRunTime } from './bestTimes'
import { capitalise } from '../sequence/levelText'
import type { Level, RibbonWord, RunFeedback } from '../types'

const props = defineProps<{
  level: Level
  waiting: boolean
  sentenceIndex: number
  sentenceCount: number
  translation: string
  ribbon: RibbonWord[]
  nextGloss: string | null
  feedback: RunFeedback | null
  standing: number
  rivalName: string
  runSeconds: number
}>()

const isLeading = computed(() => props.standing >= 0)
const standingLabel = computed(() => {
  const metres = Math.round(Math.abs(props.standing))
  return isLeading.value
    ? `You lead by ${metres} m`
    : `${capitalise(props.rivalName)} ahead by ${metres} m`
})
</script>

<template>
  <div class="word-runner-hud">
    <header class="word-runner-hud__top">
      <p class="word-runner-hud__status">
        <span>{{ level.cefr }} · {{ level.title }}</span>
        <span>Sentence {{ sentenceIndex + 1 }} / {{ sentenceCount }}</span>
        <span class="word-runner-hud__time">{{ formatRunTime(runSeconds) }}</span>
        <span
          :class="isLeading ? 'word-runner-hud__word--right' : 'word-runner-hud__word--wrong'"
          >{{ standingLabel }}</span
        >
      </p>
      <p class="word-runner-hud__translation">{{ translation }}</p>
      <ol class="word-runner-hud__ribbon" aria-label="This sentence so far">
        <li
          v-for="(word, index) in ribbon"
          :key="index"
          class="word-runner-hud__word"
          :class="word.correct ? 'word-runner-hud__word--right' : 'word-runner-hud__word--wrong'"
        >
          {{ word.text }}
        </li>
      </ol>
    </header>

    <p v-if="waiting" class="word-runner-hud__feedback lui-slide-in">
      <span>Waiting for everyone to load the course…</span>
    </p>
    <p v-else-if="feedback" class="word-runner-hud__feedback lui-slide-in">
      <span
        :class="feedback.correct ? 'word-runner-hud__word--right' : 'word-runner-hud__word--wrong'"
        >{{ feedback.text }}</span
      >
      <span class="word-runner-hud__gloss">{{ feedback.gloss }}</span>
    </p>

    <footer class="word-runner-hud__bottom">
      <p v-if="nextGloss" class="word-runner-hud__prompt">
        <span class="word-runner-hud__prompt-label">Next</span>
        <span>{{ nextGloss }}</span>
      </p>
      <p class="word-runner-hud__keys">
        <LobbyUIKeyPill :keyboard="['←', 'A']" :gamepad="['D-pad ←']" />
        <span>Change lane</span>
        <LobbyUIKeyPill :keyboard="['→', 'D']" :gamepad="['D-pad →']" />
      </p>
    </footer>
  </div>
</template>

<style scoped>
.word-runner-hud {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: grid;
  grid-template-areas:
    'top'
    'middle'
    'bottom';
  grid-template-rows: auto 1fr auto;
  padding: var(--spacing-4);
  padding-top: calc(var(--nav-height) + var(--spacing-4));
  font-family: var(--lui-font);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  pointer-events: none;
}

.word-runner-hud__top {
  display: flex;
  flex-direction: column;
  grid-area: top;
  gap: var(--spacing-2);
  align-items: center;
}

.word-runner-hud__status {
  display: flex;
  gap: var(--spacing-3);
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: center;
  margin: 0;
  font-size: var(--lui-text-small);
  font-variant-numeric: tabular-nums;
  text-transform: uppercase;
}

.word-runner-hud__time {
  font-variant-numeric: tabular-nums;
}

.word-runner-hud__ribbon {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2);
  justify-content: center;
  min-height: 1.2em;
  padding: 0;
  margin: 0;
  font-size: var(--lui-text-medium);
  list-style: none;
}

.word-runner-hud__word--right {
  color: var(--lui-answer-right);
}

.word-runner-hud__word--wrong {
  color: var(--lui-answer-wrong);
}

.word-runner-hud__feedback {
  display: flex;
  flex-direction: column;
  grid-area: middle;
  gap: var(--spacing-1);
  align-items: center;
  align-self: start;
  margin: var(--spacing-6) 0 0;
  font-size: var(--lui-text-important);
}

.word-runner-hud__gloss {
  font-size: var(--lui-text-small);
}

.word-runner-hud__translation {
  max-width: 40rem;
  margin: 0;
  font-size: var(--lui-text-medium);
  text-align: center;
}

.word-runner-hud__bottom {
  display: flex;
  flex-direction: column;
  grid-area: bottom;
  gap: var(--spacing-3);
  align-items: center;
}

.word-runner-hud__prompt {
  display: flex;
  gap: var(--spacing-2);
  align-items: baseline;
  margin: 0;
  font-size: var(--lui-text-medium);
}

.word-runner-hud__prompt-label {
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
}

.word-runner-hud__keys {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  margin: 0;
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
}
</style>
