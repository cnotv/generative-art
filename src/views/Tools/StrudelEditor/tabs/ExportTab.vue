<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ButtonSelector from '@/components/ui/button-selector/ButtonSelector.vue'
import {
  EXPORT_DEFAULT_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
  EXPORT_SAMPLE_RATE_OPTIONS
} from '../config'
import type { StrudelExportFormat, StrudelExportOptions, StrudelExportStatus } from '../types'

const props = defineProps<{
  status: StrudelExportStatus
  errorMessage: string
}>()

const emit = defineEmits<{
  export: [exportOptions: StrudelExportOptions]
}>()

const format = ref<StrudelExportFormat>(EXPORT_DEFAULT_OPTIONS.format)
const fileName = ref(EXPORT_DEFAULT_OPTIONS.fileName)
const startCycle = ref(EXPORT_DEFAULT_OPTIONS.startCycle)
// A length rather than an end cycle, so one play-through is simply 1 and can never be empty.
const cycleCount = ref(EXPORT_DEFAULT_OPTIONS.endCycle - EXPORT_DEFAULT_OPTIONS.startCycle)
const sampleRate = ref(String(EXPORT_DEFAULT_OPTIONS.sampleRate))

const isRendering = computed(() => props.status === 'rendering')
const formatLabel = computed(() => (format.value === 'midi' ? 'MIDI' : 'WAV'))
const hasValidRange = computed(
  () =>
    Number.isFinite(startCycle.value) &&
    Number.isFinite(cycleCount.value) &&
    startCycle.value >= 0 &&
    cycleCount.value > 0
)

const readCycle = (value: string | number): number => Math.floor(Number(value))

const onFormatChange = (nextFormat: string): void => {
  format.value = nextFormat === 'midi' ? 'midi' : 'wav'
}

const onExport = (): void => {
  if (isRendering.value || !hasValidRange.value) {
    return
  }
  emit('export', {
    format: format.value,
    fileName: fileName.value,
    startCycle: startCycle.value,
    endCycle: startCycle.value + cycleCount.value,
    sampleRate: Number(sampleRate.value)
  })
}
</script>

<template>
  <section class="strudel-export">
    <p class="strudel-export__intro">
      WAV is the sound as it plays, rendered offline and faster than real time. MIDI is its notes,
      for a DAW or a synth: drum samples become General MIDI drums, other samples and effects are
      left out. Playback stops while it renders.
    </p>
    <div class="strudel-export__field">
      <span class="strudel-export__label">Format</span>
      <ButtonSelector
        :model-value="format"
        :options="EXPORT_FORMAT_OPTIONS"
        @update:model-value="onFormatChange"
      />
    </div>
    <label class="strudel-export__field">
      <span class="strudel-export__label">File name</span>
      <Input v-model="fileName" placeholder="Leave empty for a dated name" />
    </label>
    <div class="strudel-export__row">
      <label class="strudel-export__field">
        <span class="strudel-export__label">Start cycle</span>
        <Input
          type="number"
          :min="0"
          :model-value="startCycle"
          @update:model-value="startCycle = readCycle($event)"
        />
      </label>
      <label class="strudel-export__field">
        <span class="strudel-export__label">Cycles</span>
        <Input
          type="number"
          :min="1"
          :model-value="cycleCount"
          @update:model-value="cycleCount = readCycle($event)"
        />
      </label>
    </div>
    <div v-if="format === 'wav'" class="strudel-export__field">
      <span class="strudel-export__label">Sample rate</span>
      <ButtonSelector v-model="sampleRate" :options="EXPORT_SAMPLE_RATE_OPTIONS" />
    </div>
    <Button
      size="sm"
      class="strudel-export__button"
      :disabled="isRendering || !hasValidRange"
      @click="onExport"
    >
      <Download aria-hidden="true" />
      {{ isRendering ? 'Rendering...' : `Export to ${formatLabel}` }}
    </Button>
    <p v-if="!hasValidRange" class="strudel-export__error" role="alert">
      Export at least one cycle, from cycle 0 or later.
    </p>
    <p v-else-if="status === 'error'" class="strudel-export__error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-else-if="status === 'done'" class="strudel-export__status" role="status">
      The file was downloaded.
    </p>
  </section>
</template>

<style scoped>
.strudel-export {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
}

.strudel-export__intro,
.strudel-export__status {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-muted-foreground);
}

.strudel-export__field {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.strudel-export__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-3);
}

.strudel-export__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-muted-foreground);
}

.strudel-export__button {
  align-self: flex-start;
  gap: var(--spacing-2);
}

.strudel-export__error {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-destructive);
}
</style>
