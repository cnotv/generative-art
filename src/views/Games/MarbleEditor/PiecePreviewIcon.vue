<script setup lang="ts">
import type { TrackPieceType } from './types'

defineProps<{ type: TrackPieceType }>()

// Top-down schematic glyph of each piece, drawn as a single stroked path.
const PIECE_GLYPH_PATHS: Record<TrackPieceType, string> = {
  start: 'M12 21 V9 M7 9 h10 M12 9 V4 h5 v3 h-5',
  finish: 'M12 21 V11 M8 3 h8 v7 h-8 z M8 6.5 h8 M12 3 v7',
  'straight-short': 'M12 17 V7',
  'straight-long': 'M12 21 V3',
  'curve-left': 'M14 20 V14 Q14 8 8 8 H4',
  'curve-right': 'M10 20 V14 Q10 8 16 8 H20',
  'banked-left': 'M15 20 V14 Q15 9 9 9 H4 M19 19 V13 Q19 5 6 5',
  'banked-right': 'M9 20 V14 Q9 9 15 9 H20 M5 19 V13 Q5 5 18 5',
  'ramp-up': 'M4 19 L16 8 m0 0 h-4.5 m4.5 0 v4.5',
  'ramp-down': 'M4 6 L16 17 m0 0 h-4.5 m4.5 0 v-4.5',
  funnel: 'M5 4 L12 12 L19 4 M12 12 V19 m-2.5 0 h5',
  loop: 'M4 19 H9 A5.5 5.5 0 1 1 15 19 H20',
  'gap-jump': 'M3 15 h6 l2.5 -4 M14 15 h7 M14 15 l-1.5 -2.5',
  'boost-pad': 'M7 17 l4.5 -5 -4.5 -5 M13 17 l4.5 -5 -4.5 -5',
  'bumper-field': 'M6 4 v16 M18 4 v16 M10 8 h0.01 M14 12 h0.01 M10 16 h0.01'
}
</script>

<template>
  <svg class="piece-preview-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      :d="PIECE_GLYPH_PATHS[type]"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.piece-preview-icon {
  display: block;
}
</style>
