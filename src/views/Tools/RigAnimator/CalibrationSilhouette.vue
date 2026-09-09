<script setup lang="ts">
import type { CameraCalibrationStep } from './cameraCalibration'

defineProps<{
  /** Which stance to trace: a relaxed front-on stance for 'front', turned to the side with one
   * arm stretched for 'side'. Only ever rendered for those two steps, see `CameraPoseCapture`'s
   * own guard: 'assignParts' has no camera-feed guide to show. */
  step: Exclude<CameraCalibrationStep, 'assignParts' | null>
}>()
</script>

<template>
  <svg viewBox="0 0 100 150" class="calibration-silhouette" aria-hidden="true">
    <g v-if="step === 'front'" class="calibration-silhouette__figure">
      <circle cx="50" cy="18" r="10" />
      <line x1="50" y1="28" x2="50" y2="82" />
      <line x1="50" y1="40" x2="26" y2="66" />
      <line x1="50" y1="40" x2="74" y2="66" />
      <line x1="50" y1="82" x2="36" y2="140" />
      <line x1="50" y1="82" x2="64" y2="140" />
    </g>
    <g v-else class="calibration-silhouette__figure">
      <circle cx="38" cy="18" r="10" />
      <line x1="40" y1="28" x2="46" y2="82" />
      <line x1="42" y1="40" x2="94" y2="40" />
      <line x1="46" y1="82" x2="40" y2="140" />
      <line x1="46" y1="82" x2="60" y2="140" />
    </g>
  </svg>
</template>

<style scoped>
.calibration-silhouette {
  display: block;
}

.calibration-silhouette__figure {
  fill: none;
  stroke: var(--color-canvas-overlay-foreground);
  stroke-width: 4;
  stroke-linecap: round;
  stroke-dasharray: 3 5;
  opacity: 0.6;
  filter: drop-shadow(var(--shadow-text-canvas-overlay));
}
</style>
