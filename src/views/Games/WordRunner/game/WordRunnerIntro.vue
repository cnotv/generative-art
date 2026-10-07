<script setup lang="ts">
import { LobbyUIKeyPill } from '@/components/LobbyUI'
import type { Level } from '../types'

defineProps<{
  level: Level
  solo: boolean
  touch: boolean
}>()
</script>

<template>
  <!-- Passes every touch through to the course, where a tap is what starts the race. -->
  <div class="word-runner-intro">
    <div class="word-runner-intro__content">
      <header class="word-runner-intro__header lui-slide-in">
        <p class="word-runner-intro__level">{{ level.cefr }} · {{ level.title }}</p>
        <h2 class="word-runner-intro__title">{{ level.situation }}</h2>
      </header>

      <ul class="word-runner-intro__rules lui-slide-in lui-slide-in--2">
        <li>Read the English at the top, then roll through its next word.</li>
        <li>The right word is the faster route. A wrong one slows you down.</li>
        <li v-if="solo">Beat the bot to the line to open the next level.</li>
        <li v-else>The first ball over the line wins.</li>
      </ul>

      <p v-if="touch" class="word-runner-intro__controls lui-slide-in lui-slide-in--2">
        Steer with the arrows at the sides, brake with the one between
      </p>
      <dl v-else class="word-runner-intro__controls lui-slide-in lui-slide-in--2">
        <div class="word-runner-intro__control">
          <dt>Steer</dt>
          <dd>
            <LobbyUIKeyPill :keyboard="['←', '→']" :gamepad="['LS']" />
          </dd>
        </div>
        <div class="word-runner-intro__control">
          <dt>Brake</dt>
          <dd>
            <LobbyUIKeyPill :keyboard="['↓']" :gamepad="['LS ↓']" />
          </dd>
        </div>
      </dl>

      <p class="word-runner-intro__prompt lui-slide-in lui-slide-in--3">
        {{ touch ? 'Tap to start' : 'Press any key to start' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.word-runner-intro {
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

.word-runner-intro__content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-5);
  align-items: center;
  max-width: 40rem;
  text-align: center;
}

.word-runner-intro__header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  align-items: center;
}

.word-runner-intro__level,
.word-runner-intro__title,
.word-runner-intro__rules,
.word-runner-intro__controls,
.word-runner-intro__prompt {
  margin: 0;
  font-family: var(--lui-font);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
}

.word-runner-intro__level {
  font-size: var(--lui-text-tiny);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.word-runner-intro__title {
  font-size: var(--lui-text-medium);
  line-height: 1;
  text-transform: uppercase;
}

.word-runner-intro__rules {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  padding: 0;
  font-size: var(--lui-text-small);
  list-style: none;
}

.word-runner-intro__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2) var(--spacing-6);
  justify-content: center;
  font-size: var(--lui-text-small);
}

.word-runner-intro__control {
  display: flex;
  gap: var(--spacing-2);
  align-items: center;
  text-transform: uppercase;
}

.word-runner-intro__control dd {
  margin: 0;
}

.word-runner-intro__prompt {
  font-size: var(--lui-text-medium);
  color: var(--lui-focus-color);
  text-transform: uppercase;
}
</style>
