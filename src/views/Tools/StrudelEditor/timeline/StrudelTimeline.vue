<script setup lang="ts">
import { computed } from 'vue'
import { Pause, Play } from 'lucide-vue-next'
import IconButton from '@/components/IconButton.vue'
import { Slider } from '@/components/ui/slider'
import { STRUDEL_TIMELINE_MAX_LOOP_BARS, STRUDEL_TIMELINE_SEEK_STEP } from '../config'

const props = defineProps<{
  playheadCycle: number
  timelineBars: number
  cyclesPerSecond: number
  loopBars: number | null
  loopMeasured: boolean
  isPlaying: boolean
}>()

const emit = defineEmits<{
  seek: [cycle: number]
  play: []
  pause: []
}>()

const playPauseLabel = computed(() => (props.isPlaying ? 'Pause' : 'Play from here'))

const onPlayPausePressed = (): void => {
  if (props.isPlaying) {
    emit('pause')
    return
  }
  emit('play')
}

const formatSeconds = (cycles: number): string => (cycles / props.cyclesPerSecond).toFixed(1)

const loopLabel = computed(() => {
  if (!props.loopMeasured) {
    return 'Loop length shows once the pattern plays'
  }
  if (props.loopBars === null) {
    return `No repeat within ${STRUDEL_TIMELINE_MAX_LOOP_BARS} bars`
  }
  return props.loopBars === 1 ? 'Loops every bar' : `Loops every ${props.loopBars} bars`
})

const onSliderMoved = (values: number[] | undefined): void => {
  const [cycle] = values ?? []
  if (cycle !== undefined) {
    emit('seek', cycle)
  }
}
</script>

<template>
  <section class="strudel-timeline" aria-label="Timeline" :title="loopLabel">
    <IconButton
      size="sm"
      variant="ghost"
      :title="playPauseLabel"
      :aria-label="playPauseLabel"
      @click="onPlayPausePressed"
    >
      <Pause v-if="isPlaying" aria-hidden="true" />
      <Play v-else aria-hidden="true" />
    </IconButton>
    <Slider
      class="strudel-timeline__track"
      :model-value="[playheadCycle]"
      :min="0"
      :max="timelineBars"
      :step="STRUDEL_TIMELINE_SEEK_STEP"
      label="Play position"
      @update:model-value="onSliderMoved"
    />
    <p class="strudel-timeline__readout">
      {{ Math.floor(playheadCycle) + 1 }}/{{ timelineBars }} · {{ formatSeconds(playheadCycle) }}s
    </p>
  </section>
</template>

<style scoped>
.strudel-timeline {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr) max-content;
  align-items: center;
  gap: var(--spacing-2);
  color: var(--color-muted-foreground);
}

.strudel-timeline__readout {
  margin: 0;
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}
</style>
