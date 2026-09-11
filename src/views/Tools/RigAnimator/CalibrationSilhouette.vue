<script setup lang="ts">
import type { CalibrationPoseKind } from './types'

defineProps<{
  /** Which T-pose to trace: square-on, or turned sideways with the arms pointing at and away
   * from the camera. */
  step: CalibrationPoseKind
  /** Whether the live pose matches, so the guide confirms it before the countdown ends. */
  matched: boolean
}>()
</script>

<template>
  <svg
    viewBox="0 0 100 150"
    class="calibration-silhouette"
    :class="{ 'calibration-silhouette--matched': matched }"
    aria-hidden="true"
  >
    <g v-if="step === 'front'" class="calibration-silhouette__figure">
      <circle cx="50" cy="22" r="9" />
      <line x1="50" y1="31" x2="50" y2="84" />
      <line x1="8" y1="42" x2="92" y2="42" />
      <line x1="50" y1="84" x2="40" y2="140" />
      <line x1="50" y1="84" x2="60" y2="140" />
    </g>
    <g v-else class="calibration-silhouette__figure">
      <circle cx="50" cy="22" r="9" />
      <line x1="50" y1="31" x2="50" y2="84" />
      <circle cx="50" cy="42" r="5" />
      <line x1="44" y1="42" x2="56" y2="42" />
      <line x1="50" y1="84" x2="46" y2="140" />
      <line x1="50" y1="84" x2="54" y2="140" />
    </g>
  </svg>
</template>

<style scoped>
.calibration-silhouette {
  display: block;
  stroke: var(--color-canvas-overlay-foreground);
  transition: stroke 0.15s ease;
}

/* The same go colour the Merge Target diagram uses for an active region: a binary matched state
   reads faster as a clear colour than as a tint. */
.calibration-silhouette--matched {
  stroke: var(--color-perf-ok);
}

.calibration-silhouette__figure {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 3 5;
  opacity: 0.7;
  filter: drop-shadow(var(--shadow-text-canvas-overlay));
}
</style>
