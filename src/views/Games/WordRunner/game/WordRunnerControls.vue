<script setup lang="ts">
import TouchControl from '@/components/TouchControl.vue'
import { TOUCH_LEFT_BUTTONS, TOUCH_RIGHT_BUTTONS } from '../config'
import WordRunnerHint from './WordRunnerHint.vue'

defineProps<{
  /** On a touch screen the buttons are real; elsewhere they are drawn keys, shown with hints. */
  touch: boolean
  hints: boolean
  currentActions: Record<string, unknown>
  onAction: (action: string) => void
}>()

// The outer button's hint stands higher, so the two hints of a corner never overlap.
const corners = [
  {
    side: 'left',
    mapping: TOUCH_LEFT_BUTTONS,
    hints: [
      { word: 'Steer', far: true },
      { word: 'Speed up', far: false }
    ]
  },
  {
    side: 'right',
    mapping: TOUCH_RIGHT_BUTTONS,
    hints: [
      { word: 'Brake', far: false },
      { word: 'Steer', far: true }
    ]
  }
] as const
</script>

<template>
  <div
    v-for="corner in corners"
    :key="corner.side"
    class="word-runner-controls"
    :class="`word-runner-controls--${corner.side}`"
  >
    <div v-if="touch || hints" class="word-runner-controls__buttons">
      <!-- One anchor per button, laid over it, holding that button's hint. -->
      <div v-if="hints" class="word-runner-controls__anchors">
        <div
          v-for="(hint, index) in corner.hints"
          :key="index"
          class="word-runner-controls__anchor"
        >
          <WordRunnerHint :word="hint.word" :side="corner.side" :far="hint.far" />
        </div>
      </div>
      <TouchControl
        v-if="touch"
        inline
        mode="button"
        :mapping="corner.mapping"
        :current-actions="currentActions"
        :on-action="onAction"
      />
      <div v-else class="word-runner-controls__keys">
        <kbd
          v-for="label in Object.keys(corner.mapping)"
          :key="label"
          class="word-runner-controls__key"
        >
          {{ label }}
        </kbd>
      </div>
    </div>
  </div>
</template>

<style scoped>
.word-runner-controls {
  position: absolute;
  bottom: var(--spacing-6);
  z-index: var(--z-dropdown);
  display: flex;
  gap: var(--spacing-2);
  align-items: flex-end;
}

.word-runner-controls--left {
  left: var(--spacing-6);
}

.word-runner-controls--right {
  right: var(--spacing-6);
}

.word-runner-controls__buttons {
  position: relative;
}

.word-runner-controls__anchors {
  position: absolute;
  inset: 0;
  display: flex;
  gap: var(--spacing-2);
  pointer-events: none;
}

.word-runner-controls__anchor {
  position: relative;
  flex: 1;
}

.word-runner-controls__keys {
  display: flex;
  gap: var(--spacing-2);
}

.word-runner-controls__key {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--spacing-12);
  height: var(--spacing-12);
  font-family: var(--lui-font);
  font-size: var(--lui-text-medium);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  border: 2px solid var(--lui-stroke);
  border-radius: var(--lui-radius-sketch-small);
}
</style>
