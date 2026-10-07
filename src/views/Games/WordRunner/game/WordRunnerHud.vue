<script setup lang="ts">
import type { RibbonWord } from '../types'

defineProps<{
  waiting: boolean
  translation: string
  ribbon: RibbonWord[]
}>()
</script>

<template>
  <div class="word-runner-hud">
    <header class="word-runner-hud__top">
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
    <p v-if="waiting" class="word-runner-hud__waiting lui-slide-in">
      Waiting for everyone to load the course…
    </p>
  </div>
</template>

<style scoped>
.word-runner-hud {
  position: absolute;
  inset: 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
  align-items: center;
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
  gap: var(--spacing-2);
  align-items: center;
}

.word-runner-hud__translation {
  max-width: 40rem;
  margin: 0;
  font-size: var(--lui-text-medium);
  text-align: center;
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

.word-runner-hud__waiting {
  margin: 0;
  font-size: var(--lui-text-medium);
}
</style>
