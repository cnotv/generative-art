<script setup lang="ts">
defineProps<{
  word: string
  /** Which way the arrow curves down to its control: towards the screen's edge on that side. */
  side: 'left' | 'right'
  /** A far hint stands higher, so two hints over neighbouring controls do not overlap. */
  far?: boolean
}>()
</script>

<template>
  <div
    class="word-runner-hint"
    :class="[`word-runner-hint--${side}`, { 'word-runner-hint--far': far }]"
    aria-hidden="true"
  >
    <div class="word-runner-hint__body lui-pulse">
      <span class="word-runner-hint__word">{{ word }}</span>
      <svg class="word-runner-hint__arrow" viewBox="0 0 64 56" preserveAspectRatio="none">
        <!-- Drawn twice, ink under white, for the kit's outlined look. A slight wobble in the
             curve and an uneven head keep it hand-drawn. -->
        <g class="word-runner-hint__ink">
          <path d="M56 4 C58 20 47 33 31 40 C24 43 17 45 9 48" vector-effect="non-scaling-stroke" />
          <path d="M9 48 L19 37 M9 48 L22 52" vector-effect="non-scaling-stroke" />
        </g>
        <g class="word-runner-hint__stroke">
          <path d="M56 4 C58 20 47 33 31 40 C24 43 17 45 9 48" vector-effect="non-scaling-stroke" />
          <path d="M9 48 L19 37 M9 48 L22 52" vector-effect="non-scaling-stroke" />
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.word-runner-hint {
  position: absolute;
  bottom: 100%;
  margin-bottom: var(--spacing-1);
  pointer-events: none;
}

.word-runner-hint--left {
  left: 50%;
}

.word-runner-hint--right {
  right: 50%;
}

.word-runner-hint__body {
  display: flex;
  flex-direction: column;
}

.word-runner-hint--left .word-runner-hint__body {
  align-items: flex-start;
  transform-origin: bottom left;
}

.word-runner-hint--right .word-runner-hint__body {
  align-items: flex-end;
  transform-origin: bottom right;
}

.word-runner-hint__word {
  font-family: var(--lui-font);
  font-size: var(--lui-text-small);
  color: var(--lui-text-color);
  text-shadow: var(--lui-text-shadow);
  text-transform: uppercase;
  white-space: nowrap;
}

.word-runner-hint--left .word-runner-hint__word {
  padding-left: var(--spacing-8);
}

.word-runner-hint--right .word-runner-hint__word {
  padding-right: var(--spacing-8);
}

.word-runner-hint__arrow {
  width: var(--spacing-12);
  height: var(--spacing-10);
  overflow: visible;
}

/* Stretched taller, its stroke kept even by non-scaling-stroke on the paths. */
.word-runner-hint--far .word-runner-hint__arrow {
  height: calc(var(--spacing-10) * 2.5);
}

/* The drawing points down to the left; on the right it is mirrored to point down to the right. */
.word-runner-hint--right .word-runner-hint__arrow {
  transform: scaleX(-1);
}

.word-runner-hint__ink,
.word-runner-hint__stroke {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.word-runner-hint__ink {
  stroke: var(--lui-outline-color);
  stroke-width: 7;
}

.word-runner-hint__stroke {
  stroke: var(--lui-text-color);
  stroke-width: 3.5;
}
</style>
